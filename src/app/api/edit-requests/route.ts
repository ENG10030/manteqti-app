import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// جلب جميع طلبات التعديل
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');

    const where: Record<string, unknown> = {};
    
    if (status) {
      where.status = status;
    }
    
    if (userId) {
      where.userId = userId;
    }

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
            images: true,
            videos: true,
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
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(editRequests);
  } catch (error) {
    console.error('Error fetching edit requests:', error);
    return NextResponse.json({ error: 'حدث خطأ في جلب طلبات التعديل' }, { status: 500 });
  }
}

// إنشاء طلب تعديل جديد
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apartmentId, userId, newImages, newVideos, newPrice, newStatus, description } = body;

    if (!apartmentId || !userId) {
      return NextResponse.json({ error: 'معرف العقار والمستخدم مطلوبان' }, { status: 400 });
    }

    // التحقق من وجود العقار
    const apartment = await db.apartment.findUnique({
      where: { id: apartmentId }
    });

    if (!apartment) {
      return NextResponse.json({ error: 'العقار غير موجود' }, { status: 404 });
    }

    // التحقق من أن المستخدم هو صاحب العقار
    if (apartment.createdBy !== userId) {
      return NextResponse.json({ error: 'يمكن فقط صاحب العقار طلب التعديل' }, { status: 403 });
    }

    // تحديد نوع التعديل
    let editType = 'multiple';
    if (newImages?.length > 0 && !newVideos && !newPrice && !newStatus) {
      editType = 'images';
    } else if (newVideos?.length > 0 && !newImages && !newPrice && !newStatus) {
      editType = 'videos';
    } else if (newPrice && !newImages && !newVideos && !newStatus) {
      editType = 'price';
    } else if (newStatus && !newImages && !newVideos && !newPrice) {
      editType = 'status';
    }

    // إنشاء طلب التعديل
    const editRequest = await db.propertyEditRequest.create({
      data: {
        apartmentId,
        userId,
        editType,
        newImages: newImages?.length > 0 ? JSON.stringify(newImages) : null,
        newVideos: newVideos?.length > 0 ? JSON.stringify(newVideos) : null,
        newPrice: newPrice || null,
        newStatus: newStatus || null,
        description: description || null,
        status: 'pending',
      },
      include: {
        apartment: {
          select: {
            id: true,
            title: true,
            price: true,
            status: true,
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            identifier: true,
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      editRequest,
      message: 'تم إنشاء طلب التعديل بنجاح'
    });
  } catch (error) {
    console.error('Error creating edit request:', error);
    return NextResponse.json({ error: 'حدث خطأ في إنشاء طلب التعديل' }, { status: 500 });
  }
}
