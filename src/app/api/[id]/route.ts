import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET, verifyAuth } from '@/lib/auth';

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

    // Security: Hide ownerPhone from non-authenticated users
    const token = (await cookies()).get('auth-token')?.value;
    if (!token) {
      const { ownerPhone, ...publicData } = apartment;
      return NextResponse.json(publicData);
    }

    try {
      const decoded = verify(token, JWT_SECRET) as any;
      if (decoded.role === 'DEVELOPER') {
        return NextResponse.json(apartment);
      }
      return NextResponse.json(apartment);
    } catch {
      const { ownerPhone, ...publicData } = apartment;
      return NextResponse.json(publicData);
    }

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
    const decoded = await verifyAuth(request);
    if (!decoded) {
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

    if ((body.action === 'approve' || body.action === 'reject') && decoded.role !== 'DEVELOPER') {
      return NextResponse.json({ error: "غير مصرح - مطلوب صلاحيات المطور" }, { status: 403 });
    }

    if (body.action !== 'approve' && body.action !== 'reject') {
      if (decoded.role !== 'DEVELOPER' && existingApartment.createdBy !== decoded.id) {
        return NextResponse.json({ error: "غير مصرح - ليس عقارك" }, { status: 403 });
      }
    }

    let updateData: Record<string, unknown> = {};

    if (body.action === 'approve') {
      updateData = {
        status: 'available',
        approvedBy: body.approvedBy || decoded.id,
        approvedAt: new Date(),
      };
    } else if (body.action === 'reject') {
      updateData = {
        status: 'rejected',
      };
    } else {
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
        images: Array.isArray(body.images) ? JSON.stringify(body.images) : body.images,
        videos: Array.isArray(body.videos) ? JSON.stringify(body.videos) : body.videos,
        amenities: Array.isArray(body.amenities) ? JSON.stringify(body.amenities) : body.amenities,
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
    if (error && typeof error === 'object' && 'status' in error) {
      return error as NextResponse;
    }
    console.error('Error updating apartment:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const decoded = await verifyAuth(request);
    if (!decoded) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;

    const existingApartment = await db.apartment.findUnique({ where: { id } });
    if (!existingApartment) {
      return NextResponse.json({ error: 'العقار غير موجود' }, { status: 404 });
    }

    if (decoded.role !== 'DEVELOPER' && existingApartment.createdBy !== decoded.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    if (decoded.role !== 'DEVELOPER' && existingApartment.status !== 'pending') {
      return NextResponse.json({ error: "لا يمكنك حذف عقار تمت الموافقة عليه" }, { status: 403 });
    }

    await db.payment.deleteMany({ where: { inquiry: { apartmentId: id } } });
    await db.inquiry.deleteMany({ where: { apartmentId: id } });
    await db.apartment.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) {
      return error as NextResponse;
    }
    console.error('Error deleting apartment:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURE: Require authentication for PATCH - was previously unprotected!
    const decoded = await verifyAuth(request);
    if (!decoded) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    if (decoded.role !== 'DEVELOPER') {
      return NextResponse.json({ error: "غير مصرح - مطلوب صلاحيات المطور" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existingApartment = await db.apartment.findUnique({ where: { id } });
    if (!existingApartment) {
      return NextResponse.json({ error: 'العقار غير موجود' }, { status: 404 });
    }

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
    if (error && typeof error === 'object' && 'status' in error) {
      return error as NextResponse;
    }
    console.error('Error patching apartment:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
