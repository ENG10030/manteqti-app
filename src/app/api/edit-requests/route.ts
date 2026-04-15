import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

// جلب طلبات التعديل
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const apartmentId = searchParams.get('apartmentId');

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (apartmentId) where.apartmentId = apartmentId;

    const editRequests = await db.propertyEditRequest.findMany({
      where,
      include: {
        apartment: {
          select: {
            id: true,
            title: true,
            price: true,
            status: true,
            images: true,
            videos: true,
            type: true,
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            identifier: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(editRequests);
  } catch (error) {
    console.error('Error fetching edit requests:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// إنشاء طلب تعديل جديد
export async function POST(request: NextRequest) {
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

    const tokenUserId = decoded.userId;
    const body = await request.json();

    // التحقق من وجود العقار
    const apartment = await db.apartment.findUnique({
      where: { id: body.apartmentId },
    });

    if (!apartment) {
      return NextResponse.json({ error: 'العقار غير موجود' }, { status: 404 });
    }

    // التحقق من أن العقار موافق عليه (منشور)
    if (apartment.status !== 'available') {
      return NextResponse.json({ error: 'لا يمكن طلب تعديل على عقار غير منشور' }, { status: 400 });
    }

    // التحقق من عدم وجود طلب تعديل معلق سابق
    const existingRequest = await db.propertyEditRequest.findFirst({
      where: {
        apartmentId: body.apartmentId,
        userId: body.userId,
        status: 'pending',
      },
    });

    if (existingRequest) {
      return NextResponse.json({ error: 'يوجد طلب تعديل معلق بالفعل على هذا العقار' }, { status: 400 });
    }

    // تحديد نوع التعديل
    let editType = 'multiple';
    const hasImages = body.newImages && body.newImages.length > 0;
    const hasVideos = body.newVideos && body.newVideos.length > 0;
    const hasPrice = body.newPrice !== undefined && body.newPrice !== null;
    const hasStatus = body.newStatus !== undefined && body.newStatus !== null;

    if (hasImages && !hasVideos && !hasPrice && !hasStatus) editType = 'images';
    else if (hasVideos && !hasImages && !hasPrice && !hasStatus) editType = 'videos';
    else if (hasPrice && !hasImages && !hasVideos && !hasStatus) editType = 'price';
    else if (hasStatus && !hasImages && !hasVideos && !hasPrice) editType = 'status';

    const editRequest = await db.propertyEditRequest.create({
      data: {
        apartmentId: body.apartmentId,
        userId: body.userId,
        editType,
        newImages: body.newImages ? JSON.stringify(body.newImages) : null,
        newVideos: body.newVideos ? JSON.stringify(body.newVideos) : null,
        newPrice: body.newPrice ? parseInt(body.newPrice) : null,
        newStatus: body.newStatus || null,
        description: body.description || null,
        status: 'pending',
      },
      include: {
        apartment: {
          select: {
            id: true,
            title: true,
          }
        },
        user: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      editRequest,
      message: 'تم إرسال طلب التعديل بنجاح. سيتم مراجعته من قبل المطور.'
    });
  } catch (error) {
    console.error('Error creating edit request:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إرسال طلب التعديل' }, { status: 500 });
  }
}

// حذف طلب تعديل أو حذف طلبات التعديل
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const clearAll = searchParams.get('clearAll');

    if (id) {
      await db.propertyEditRequest.delete({ where: { id } });
    } else if (clearAll === 'true') {
      await db.propertyEditRequest.deleteMany({});
    } else {
      await db.propertyEditRequest.deleteMany({ where: { status: 'pending' } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting edit requests:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
