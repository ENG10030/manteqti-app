import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/auth';



// Helper: get authenticated user from token
async function getAuthUser(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) return null;
    
    const decoded = verify(token, JWT_SECRET) as { userId: string; role: string };
    return { userId: decoded.userId, role: decoded.role || 'USER' };
  } catch {
    return null;
  }
}

// جلب طلبات التعديل (المطور فقط)
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }

    if (auth.role !== 'DEVELOPER') {
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
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب طلبات التعديل' }, { status: 500 });
  }
}

// إنشاء طلب تعديل جديد (يتطلب تسجيل الدخول)
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }

    const tokenUserId = auth.userId;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 });
    }

    // Validate required fields
    if (!body.apartmentId) {
      return NextResponse.json({ error: 'معرف العقار مطلوب' }, { status: 400 });
    }

    // Check if user is blocked
    const user = await db.user.findUnique({
      where: { id: tokenUserId },
      select: { isBlocked: true, name: true },
    });

    if (user?.isBlocked) {
      return NextResponse.json({ error: 'تم حظر حسابك' }, { status: 403 });
    }

    // التحقق من وجود العقار
    const apartment = await db.apartment.findUnique({
      where: { id: body.apartmentId },
    });

    if (!apartment) {
      return NextResponse.json({ error: 'العقار غير موجود' }, { status: 404 });
    }

    // التحقق من أن العقار موافق عليه (منشور)
    if (apartment.status !== 'available' && apartment.status !== 'reserved') {
      return NextResponse.json({ error: 'لا يمكن طلب تعديل على عقار غير منشور' }, { status: 400 });
    }

    // التحقق من أن المستخدم هو مالك العقار أو المطور
    if (apartment.createdBy !== tokenUserId && auth.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'يمكنك فقط طلب تعديل على عقاراتك' }, { status: 403 });
    }

    // ✅ التحقق من عدم وجود طلب تعديل معلق سابق - using tokenUserId
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
    const hasImages = body.newImages && Array.isArray(body.newImages) && body.newImages.length > 0;
    const hasVideos = body.newVideos && Array.isArray(body.newVideos) && body.newVideos.length > 0;
    const hasPrice = body.newPrice !== undefined && body.newPrice !== null;
    const hasStatus = body.newStatus !== undefined && body.newStatus !== null;

    if (hasImages && !hasVideos && !hasPrice && !hasStatus) editType = 'images';
    else if (hasVideos && !hasImages && !hasPrice && !hasStatus) editType = 'videos';
    else if (hasPrice && !hasImages && !hasVideos && !hasStatus) editType = 'price';
    else if (hasStatus && !hasImages && !hasVideos && !hasPrice) editType = 'status';

    // Check if there's anything to actually edit
    if (!hasImages && !hasVideos && !hasPrice && !hasStatus && !body.description) {
      return NextResponse.json({ error: 'يرجى تحديد التعديلات المطلوبة' }, { status: 400 });
    }

    const editRequest = await db.propertyEditRequest.create({
      data: {
        apartmentId: body.apartmentId,
        userId: tokenUserId, // ✅ Always use token userId
        editType,
        newImages: hasImages ? JSON.stringify(body.newImages) : null,
        newVideos: hasVideos ? JSON.stringify(body.newVideos) : null,
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
