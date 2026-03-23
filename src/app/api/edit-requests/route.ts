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
      orderBy: {
        createdAt: 'desc',
      },
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
    const body = await request.json();
    const { apartmentId, userId, newImages, newVideos, newPrice, newStatus, description } = body;

    // التحقق من وجود العقار
    const apartment = await db.apartment.findUnique({
      where: { id: apartmentId },
    });

    if (!apartment) {
      return NextResponse.json({ error: 'العقار غير موجود' }, { status: 404 });
    }

    // التحقق من عدم وجود طلب تعديل معلق لنفس العقار من نفس المستخدم
    const existingRequest = await db.propertyEditRequest.findFirst({
      where: {
        apartmentId,
        userId,
        status: 'pending',
      },
    });

    if (existingRequest) {
      return NextResponse.json({ error: 'لديك طلب تعديل معلق بالفعل على هذا العقار' }, { status: 400 });
    }

    // إنشاء طلب التعديل
    const editRequest = await db.propertyEditRequest.create({
      data: {
        apartmentId,
        userId,
        editType: 'update',
        newImages: newImages && newImages.length > 0 ? JSON.stringify(newImages) : null,
        newVideos: newVideos && newVideos.length > 0 ? JSON.stringify(newVideos) : null,
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
      },
    });

    return NextResponse.json(editRequest);
  } catch (error) {
    console.error('Error creating edit request:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
