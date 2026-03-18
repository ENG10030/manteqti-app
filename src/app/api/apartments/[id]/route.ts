import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// جلب عقار واحد
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const apartment = await db.apartment.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        inquiries: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        payments: {
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
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب العقار' }, { status: 500 });
  }
}

// تحديث عقار
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // التحقق من وجود العقار
    const existingApartment = await db.apartment.findUnique({
      where: { id },
    });

    if (!existingApartment) {
      return NextResponse.json({ error: 'العقار غير موجود' }, { status: 404 });
    }

    // تحديث العقار
    const apartment = await db.apartment.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        type: body.type,
        status: body.status,
        price: body.price ? parseFloat(body.price) : undefined,
        area: body.area ? parseFloat(body.area) : undefined,
        bedrooms: body.bedrooms ? parseInt(body.bedrooms) : undefined,
        bathrooms: body.bathrooms ? parseInt(body.bathrooms) : undefined,
        floor: body.floor ? parseInt(body.floor) : undefined,
        address: body.address,
        city: body.city,
        neighborhood: body.neighborhood,
        images: body.images,
        videos: body.videos,
        amenities: body.amenities,
        isFeatured: body.isFeatured,
        isVip: body.isVip,
        featuredUntil: body.featuredUntil ? new Date(body.featuredUntil) : undefined,
      },
    });

    return NextResponse.json(apartment);
  } catch (error) {
    console.error('Error updating apartment:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث العقار' }, { status: 500 });
  }
}

// حذف عقار
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // التحقق من وجود العقار
    const existingApartment = await db.apartment.findUnique({
      where: { id },
    });

    if (!existingApartment) {
      return NextResponse.json({ error: 'العقار غير موجود' }, { status: 404 });
    }

    // حذف المدفوعات المرتبطة
    await db.payment.deleteMany({
      where: { apartmentId: id },
    });

    // حذف الاستفسارات المرتبطة
    await db.inquiry.deleteMany({
      where: { apartmentId: id },
    });

    // حذف العقار
    await db.apartment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'تم حذف العقار بنجاح' });
  } catch (error) {
    console.error('Error deleting apartment:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف العقار' }, { status: 500 });
  }
}

// تغيير حالة العقار فقط (PATCH) - للتحديث السريع
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // التحقق من وجود العقار
    const existingApartment = await db.apartment.findUnique({
      where: { id },
    });

    if (!existingApartment) {
      return NextResponse.json({ error: 'العقار غير موجود' }, { status: 404 });
    }

    // تحديث فقط الحقول المطلوبة
    const updateData: Record<string, unknown> = {};
    
    if (body.status !== undefined) {
      updateData.status = body.status;
    }
    if (body.isFeatured !== undefined) {
      updateData.isFeatured = body.isFeatured;
    }
    if (body.isVip !== undefined) {
      updateData.isVip = body.isVip;
    }
    if (body.featuredUntil !== undefined) {
      updateData.featuredUntil = body.featuredUntil ? new Date(body.featuredUntil) : null;
    }

    const apartment = await db.apartment.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      apartment,
      message: 'تم التحديث بنجاح'
    });
  } catch (error) {
    console.error('Error patching apartment:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء التحديث' }, { status: 500 });
  }
}
