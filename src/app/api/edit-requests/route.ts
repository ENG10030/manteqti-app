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
      orderBy: { createdAt: 'desc' }
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

    // التحقق من البيانات المطلوبة
    if (!body.apartmentId || !body.userId || !body.editType) {
      return NextResponse.json({ 
        error: 'بيانات ناقصة - apartmentId, userId, editType مطلوبة' 
      }, { status: 400 });
    }

    // التحقق من وجود العقار
    const apartment = await db.apartment.findUnique({
      where: { id: body.apartmentId }
    });

    if (!apartment) {
      return NextResponse.json({ error: 'العقار غير موجود' }, { status: 404 });
    }

    // إنشاء طلب التعديل
    const editRequest = await db.propertyEditRequest.create({
      data: {
        apartmentId: body.apartmentId,
        userId: body.userId,
        editType: body.editType,
        newImages: body.newImages ? JSON.stringify(body.newImages) : null,
        newVideos: body.newVideos ? JSON.stringify(body.newVideos) : null,
        newPrice: body.newPrice || null,
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
      message: 'تم إنشاء طلب التعديل بنجاح'
    });
  } catch (error) {
    console.error('Error creating edit request:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
