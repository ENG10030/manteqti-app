import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

// جلب طلبات التعديل (للمطور)
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

    return NextResponse.json({ editRequests });
  } catch (error: any) {
    console.error('Error fetching edit requests:', error?.message || error);
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب طلبات التعديل' }, { status: 500 });
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

    if (!body.apartmentId) {
      return NextResponse.json({ error: 'معرف العقار مطلوب' }, { status: 400 });
    }

    // التحقق من وجود العقار
    const apartment = await db.apartment.findUnique({
      where: { id: body.apartmentId },
    });

    if (!apartment) {
      return NextResponse.json({ error: 'العقار غير موجود' }, { status: 404 });
    }

    // التحقق من أن العقار منشور
    if (apartment.status !== 'available' && apartment.status !== 'reserved') {
      return NextResponse.json({ error: 'لا يمكن طلب تعديل على عقار غير منشور' }, { status: 400 });
    }

    // التحقق من عدم وجود طلب معلق لنفس المستخدم على نفس العقار
    const existingRequest = await db.propertyEditRequest.findFirst({
      where: {
        apartmentId: body.apartmentId,
        userId: tokenUserId,
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

    if (hasImages && !hasVideos && !hasPrice) editType = 'images';
    else if (hasVideos && !hasImages && !hasPrice) editType = 'videos';
    else if (hasPrice && !hasImages && !hasVideos) editType = 'price';

    const editRequest = await db.propertyEditRequest.create({
      data: {
        apartmentId: body.apartmentId,
        userId: tokenUserId,
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
          select: { id: true, title: true }
        },
        user: {
          select: { id: true, name: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      editRequest,
      message: 'تم إرسال طلب التعديل بنجاح'
    });
  } catch (error: any) {
    console.error('Error creating edit request:', error?.message || error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إرسال طلب التعديل' }, { status: 500 });
  }
}
