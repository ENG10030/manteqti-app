import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/auth';
import { broadcastEvent, WebhookEvents } from '@/lib/webhook';
import { sendEditRequestApprovedEmail, sendEditRequestRejectedEmail } from '@/lib/email';

// جلب طلب تعديل محدد
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }
    try {
      verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const { id } = await params;

    const editRequest = await db.propertyEditRequest.findUnique({
      where: { id },
      include: {
        apartment: true,
        user: {
          select: {
            id: true,
            name: true,
            identifier: true,
          }
        }
      },
    });

    if (!editRequest) {
      return NextResponse.json({ error: 'طلب التعديل غير موجود' }, { status: 404 });
    }

    return NextResponse.json(editRequest);
  } catch (error) {
    console.error('Error fetching edit request:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// الموافقة أو الرفض على طلب التعديل
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }
    let decoded: any;
    try {
      decoded = verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    if (decoded.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const editRequest = await db.propertyEditRequest.findUnique({
      where: { id },
      include: { apartment: true },
    });

    if (!editRequest) {
      return NextResponse.json({ error: 'طلب التعديل غير موجود' }, { status: 404 });
    }

    if (editRequest.status !== 'pending') {
      return NextResponse.json({ error: 'تم التعامل مع هذا الطلب بالفعل' }, { status: 400 });
    }

    if (body.action === 'approve') {
      // الموافقة على التعديل - تطبيق التغييرات على العقار
      const updateData: Record<string, unknown> = {};

      // إضافة الصور الجديدة للصور الموجودة
      if (editRequest.newImages) {
        const existingImages = editRequest.apartment.images 
          ? JSON.parse(editRequest.apartment.images) 
          : [];
        const newImages = JSON.parse(editRequest.newImages);
        updateData.images = JSON.stringify([...existingImages, ...newImages]);
      }

      // إضافة الفيديوهات الجديدة للفيديوهات الموجودة
      if (editRequest.newVideos) {
        const existingVideos = editRequest.apartment.videos 
          ? JSON.parse(editRequest.apartment.videos) 
          : [];
        const newVideos = JSON.parse(editRequest.newVideos);
        updateData.videos = JSON.stringify([...existingVideos, ...newVideos]);
      }

      // تحديث السعر
      if (editRequest.newPrice) {
        updateData.price = editRequest.newPrice;
      }

      // تحديث الحالة
      if (editRequest.newStatus) {
        updateData.status = editRequest.newStatus;
      }

      // تحديث العقار
      if (Object.keys(updateData).length > 0) {
        await db.apartment.update({
          where: { id: editRequest.apartmentId },
          data: updateData,
        });
      }

      // تحديث حالة طلب التعديل
      const updatedRequest = await db.propertyEditRequest.update({
        where: { id },
        data: {
          status: 'approved',
          reviewedBy: body.reviewedBy || 'developer',
          reviewedAt: new Date(),
          reviewNotes: body.reviewNotes || null,
        },
      });

      try { await broadcastEvent(WebhookEvents.APARTMENTS_CHANGED); } catch {}

      // إرسال إيميل للمستخدم
      try {
        const editUser = await db.propertyEditRequest.findUnique({
          where: { id },
          include: { user: { select: { name: true, email: true } }, apartment: { select: { title: true } } },
        });
        if (editUser?.user?.email) {
          await sendEditRequestApprovedEmail({ to: editUser.user.email, name: editUser.user.name, apartmentTitle: editRequest.apartment.title || '' });
        }
      } catch {}

      return NextResponse.json({
        success: true,
        editRequest: updatedRequest,
        message: 'تم الموافقة على التعديل وتطبيقه بنجاح'
      });

    } else if (body.action === 'reject') {
      // رفض التعديل
      const updatedRequest = await db.propertyEditRequest.update({
        where: { id },
        data: {
          status: 'rejected',
          reviewedBy: body.reviewedBy || 'developer',
          reviewedAt: new Date(),
          reviewNotes: body.reviewNotes || null,
        },
      });

      try { await broadcastEvent(WebhookEvents.APARTMENTS_CHANGED); } catch {}

      // إرسال إيميل رفض للمستخدم
      try {
        const editUser = await db.propertyEditRequest.findUnique({
          where: { id },
          include: { user: { select: { name: true, email: true } } },
        });
        if (editUser?.user?.email) {
          await sendEditRequestRejectedEmail({ to: editUser.user.email, name: editUser.user.name, apartmentTitle: editRequest.apartment.title || '', reason: body.reviewNotes || undefined });
        }
      } catch {}

      return NextResponse.json({
        success: true,
        editRequest: updatedRequest,
        message: 'تم رفض طلب التعديل'
      });

    } else {
      return NextResponse.json({ error: 'إجراء غير صحيح' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error updating edit request:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// حذف طلب تعديل (للمستخدم فقط إذا كان معلقاً)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }
    let decoded: any;
    try {
      decoded = verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    if (decoded.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const { id } = await params;

    const editRequest = await db.propertyEditRequest.findUnique({
      where: { id },
    });

    if (!editRequest) {
      return NextResponse.json({ error: 'طلب التعديل غير موجود' }, { status: 404 });
    }

    if (editRequest.status !== 'pending') {
      return NextResponse.json({ error: 'لا يمكن حذف طلب تم التعامل معه' }, { status: 400 });
    }

    await db.propertyEditRequest.delete({
      where: { id },
    });

    try { await broadcastEvent(WebhookEvents.APARTMENTS_CHANGED); } catch {}

    return NextResponse.json({ success: true, message: 'تم حذف طلب التعديل' });
  } catch (error) {
    console.error('Error deleting edit request:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
