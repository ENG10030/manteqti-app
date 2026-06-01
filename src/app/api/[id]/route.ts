import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/auth';



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
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }
    let decoded: any;
    try {
      decoded = verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

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

    if (body.action === 'approve') {
      // الموافقة على العقار
      updateData = {
        status: 'available',
        approvedBy: body.approvedBy || 'developer',
        approvedAt: new Date(),
      };
    } else if (body.action === 'reject') {
      // رفض العقار
      updateData = {
        status: 'rejected',
      };
    } else {
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
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }
    let decoded: any;
    try {
      decoded = verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;

    await db.payment.deleteMany({ where: { inquiry: { apartmentId: id } } });
    await db.inquiry.deleteMany({ where: { apartmentId: id } });
    await db.apartment.delete({ where: { id } });

    return NextResponse.json({ success: true });
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