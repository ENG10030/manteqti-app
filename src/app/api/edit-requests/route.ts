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

    // جلب طلبات التعديل بدون include (عشان PgBouncer)
    const editRequests = await db.propertyEditRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // جلب بيانات العقارات والمستخدمين بشكل منفصل
    const apartmentIds = [...new Set(editRequests.map(r => r.apartmentId))];
    const userIds = [...new Set(editRequests.map(r => r.userId))];

    const [apartments, users] = await Promise.all([
      apartmentIds.length > 0 
        ? db.apartment.findMany({ 
            where: { id: { in: apartmentIds } },
            select: { id: true, title: true, price: true, status: true, type: true }
          })
        : [],
      userIds.length > 0
        ? db.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, identifier: true }
          })
        : []
    ]);

    const aptMap = Object.fromEntries(apartments.map(a => [a.id, a]));
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const result = editRequests.map(r => ({
      id: r.id,
      apartmentId: r.apartmentId,
      userId: r.userId,
      editType: r.editType,
      newImages: r.newImages,
      newVideos: r.newVideos,
      newPrice: r.newPrice,
      newStatus: r.newStatus,
      description: r.description,
      status: r.status,
      reviewedBy: r.reviewedBy,
      reviewedAt: r.reviewedAt,
      reviewNotes: r.reviewNotes,
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString(),
      apartment: aptMap[r.apartmentId] || null,
      user: userMap[r.userId] || null,
    }));

    return NextResponse.json({ editRequests: result });
  } catch (error: any) {
    console.error('Edit requests GET error:', error?.message || error);
    return NextResponse.json({ 
      error: 'حدث خطأ أثناء جلب طلبات التعديل',
      details: error?.message || String(error)
    }, { status: 500 });
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

    // التحقق من وجود العقار (بدون include)
    const apartment = await db.apartment.findUnique({
      where: { id: body.apartmentId },
      select: { id: true, status: true }
    });

    if (!apartment) {
      return NextResponse.json({ error: 'العقار غير موجود' }, { status: 404 });
    }

    if (apartment.status !== 'available' && apartment.status !== 'reserved') {
      return NextResponse.json({ error: 'لا يمكن طلب تعديل على عقار غير منشور' }, { status: 400 });
    }

    // التحقق من عدم وجود طلب معلق
    const existingRequest = await db.propertyEditRequest.findFirst({
      where: {
        apartmentId: body.apartmentId,
        userId: tokenUserId,
        status: 'pending',
      },
      select: { id: true }
    });

    if (existingRequest) {
      return NextResponse.json({ error: 'يوجد طلب تعديل معلق بالفعل' }, { status: 400 });
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
    });

    // جلب اسم المستخدم والعقار بشكل منفصل
    const [aptInfo, userInfo] = await Promise.all([
      db.apartment.findUnique({ where: { id: body.apartmentId }, select: { id: true, title: true } }),
      db.user.findUnique({ where: { id: tokenUserId }, select: { id: true, name: true } })
    ]);

    return NextResponse.json({
      success: true,
      editRequest: {
        ...editRequest,
        createdAt: editRequest.createdAt?.toISOString(),
        updatedAt: editRequest.updatedAt?.toISOString(),
      },
      apartment: aptInfo,
      user: userInfo,
      message: 'تم إرسال طلب التعديل بنجاح'
    });
  } catch (error: any) {
    console.error('Edit requests POST error:', error?.message || error);
    return NextResponse.json({ 
      error: 'حدث خطأ أثناء إرسال طلب التعديل',
      details: error?.message || String(error)
    }, { status: 500 });
  }
}
