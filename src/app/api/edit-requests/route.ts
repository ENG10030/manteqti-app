import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// 🔒 SECURITY: تم إزالة الـ JWT المباشر - نستخدم getCurrentUser

// جلب طلبات التعديل (للمطور)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }

    // 🔒 التحقق من الدور من قاعدة البيانات
    if (user.role !== 'DEVELOPER') {
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
      orderBy: { createdAt: 'desc' },
    });

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
  } catch (error) {
    console.error('Edit requests GET error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب طلبات التعديل' }, { status: 500 });
  }
}

// إنشاء طلب تعديل جديد
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.apartmentId) {
      return NextResponse.json({ error: 'معرف العقار مطلوب' }, { status: 400 });
    }

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

    // 🔒 SECURITY: نستخدم userId من قاعدة البيانات
    const existingRequest = await db.propertyEditRequest.findFirst({
      where: {
        apartmentId: body.apartmentId,
        userId: user.id,
        status: 'pending',
      },
      select: { id: true }
    });

    if (existingRequest) {
      return NextResponse.json({ error: 'يوجد طلب تعديل معلق بالفعل' }, { status: 400 });
    }

    let editType = 'multiple';
    const hasImages = body.newImages && body.newImages.length > 0;
    const hasVideos = body.newVideos && body.newVideos.length > 0;
    const hasPrice = body.newPrice !== undefined && body.newPrice !== null;

    if (hasImages && !hasVideos && !hasPrice) editType = 'images';
    else if (hasVideos && !hasImages && !hasPrice) editType = 'videos';
    else if (hasPrice && !hasImages && !hasVideos) editType = 'price';

    // 🔒 SECURITY: تنظيف المدخلات
    const sanitizeDescription = body.description
      ? body.description.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim()
      : null;

    const editRequest = await db.propertyEditRequest.create({
      data: {
        apartmentId: body.apartmentId,
        userId: user.id,
        editType,
        newImages: body.newImages ? JSON.stringify(body.newImages) : null,
        newVideos: body.newVideos ? JSON.stringify(body.newVideos) : null,
        newPrice: body.newPrice ? parseInt(body.newPrice) : null,
        newStatus: body.newStatus || null,
        description: sanitizeDescription,
        status: 'pending',
      },
    });

    const [aptInfo, userInfo] = await Promise.all([
      db.apartment.findUnique({ where: { id: body.apartmentId }, select: { id: true, title: true } }),
      db.user.findUnique({ where: { id: user.id }, select: { id: true, name: true } })
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
  } catch (error) {
    console.error('Edit requests POST error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إرسال طلب التعديل' }, { status: 500 });
  }
}
