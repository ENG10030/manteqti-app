import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const apartment = await db.apartment.findUnique({
      where: { id },
      include: {
        inquiries: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!apartment) {
      return NextResponse.json({ error: 'العقار غير موجود' }, { status: 404 });
    }

    return NextResponse.json(apartment);
  } catch (error) {
    console.error('Error fetching apartment:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existingApartment = await db.apartment.findUnique({
      where: { id },
    });

    if (!existingApartment) {
      return NextResponse.json({ error: 'العقار غير موجود' }, { status: 404 });
    }

    // معالجة الإجراءات الخاصة
    let updateData: Record<string, unknown> = {};

    switch (body.action) {
      case 'approve':
        // الموافقة على العقار
        updateData = {
          status: 'available',
          approvedBy: body.approvedBy || 'developer',
          approvedAt: new Date(),
        };
        break;
        
      case 'reject':
        // رفض العقار
        updateData = {
          status: 'rejected',
        };
        break;
        
      case 'feature':
        // جعل العقار مميز
        updateData = {
          isFeatured: true,
          featuredUntil: body.featuredUntil ? new Date(body.featuredUntil) : null,
        };
        break;
        
      case 'unfeature':
        // إزالة التمييز
        updateData = {
          isFeatured: false,
          featuredUntil: null,
        };
        break;
        
      case 'vip':
        // جعل العقار مميز+ (VIP)
        updateData = {
          isVip: true,
          isFeatured: true,
          featuredUntil: body.featuredUntil ? new Date(body.featuredUntil) : null,
        };
        break;
        
      case 'unvip':
        // إزالة VIP
        updateData = {
          isVip: false,
        };
        break;
        
      case 'hide':
        // إخفاء العقار (للمحظورين)
        updateData = {
          status: 'hidden',
        };
        break;
        
      case 'show':
        // إظهار العقار مرة أخرى
        updateData = {
          status: 'available',
        };
        break;
        
      default:
        // تحديث عادي
        updateData = {
          title: body.title,
          description: body.description,
          type: body.type,
          status: body.status,
          price: body.price,
          area: body.area,
          bedrooms: body.bedrooms,
          bathrooms: body.bathrooms,
          ownerPhone: body.ownerPhone,
          mapLink: body.mapLink,
          images: body.images,
          videos: body.videos,
          amenities: body.amenities,
          isFeatured: body.isFeatured,
          isVip: body.isVip,
          featuredUntil: body.featuredUntil ? new Date(body.featuredUntil) : null,
        };
    }

    const apartment = await db.apartment.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, apartment });
  } catch (error) {
    console.error('Error updating apartment:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // حذف السجلات المرتبطة
    await db.payment.deleteMany({ where: { inquiry: { apartmentId: id } } });
    await db.inquiry.deleteMany({ where: { apartmentId: id } });
    await db.like.deleteMany({ where: { apartmentId: id } });
    await db.comment.deleteMany({ where: { apartmentId: id } });
    await db.propertyEditRequest.deleteMany({ where: { apartmentId: id } });
    await db.apartment.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'تم حذف العقار' });
  } catch (error) {
    console.error('Error deleting apartment:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    
    if (body.status !== undefined) updateData.status = body.status;
    if (body.isFeatured !== undefined) updateData.isFeatured = body.isFeatured;
    if (body.isVip !== undefined) updateData.isVip = body.isVip;
    if (body.featuredUntil !== undefined) {
      updateData.featuredUntil = body.featuredUntil ? new Date(body.featuredUntil) : null;
    }

    const apartment = await db.apartment.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, apartment });
  } catch (error) {
    console.error('Error patching apartment:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
