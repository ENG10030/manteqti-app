import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, requireDeveloper } from '@/lib/auth-middleware';

async function authenticateRequest(request: NextRequest): Promise<{ userId: string; role?: string; identifier?: string } | null> {
  const { auth, errorResponse } = await getAuthContext(request);
  if (errorResponse || !auth) return null;
  return { userId: auth.userId, role: auth.role, identifier: auth.identifier };
}

async function isOwnerOrDeveloper(request: NextRequest, apartmentId: string): Promise<boolean> {
  const { auth, errorResponse } = await getAuthContext(request);
  if (errorResponse || !auth) return false;
  if (auth.role === 'DEVELOPER') return true;
  try {
    const apartment = await db.apartment.findUnique({ where: { id: apartmentId }, select: { createdBy: true } });
    return apartment?.createdBy === auth.userId;
  } catch { return false; }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

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

    // Filter out PII from inquiries for unauthenticated users
    if (!auth) {
      const filteredApartment = {
        ...apartment,
        inquiries: apartment.inquiries.map(inquiry => ({
          id: inquiry.id,
          name: inquiry.name,
          message: inquiry.message,
          createdAt: inquiry.createdAt,
        })),
      };
      return NextResponse.json(filteredApartment);
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
    const { auth, errorResponse } = await getAuthContext(request);
    if (errorResponse) return errorResponse;
    if (!auth) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { id } = await params;

    const authorized = await isOwnerOrDeveloper(request, id);
    if (!authorized) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();

    const existingApartment = await db.apartment.findUnique({ where: { id } });
    if (!existingApartment) {
      return NextResponse.json({ error: 'العقار غير موجود' }, { status: 404 });
    }

    let updateData: Record<string, unknown> = {};

    if (body.action === 'approve') {
      updateData = {
        status: 'available',
        approvedBy: auth.userId,
        approvedAt: new Date(),
      };
    } else if (body.action === 'reject') {
      updateData = { status: 'rejected' };
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
    const { auth, errorResponse } = await getAuthContext(request);
    if (errorResponse) return errorResponse;
    if (!auth) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

    const { id } = await params;

    const authorized = await isOwnerOrDeveloper(request, id);
    if (!authorized) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

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
    const { auth, errorResponse } = await requireDeveloper(request);
    if (errorResponse) return errorResponse;

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
