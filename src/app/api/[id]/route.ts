import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDeveloper, requireApprovedUser } from '@/lib/auth-middleware';
import { broadcastEvent, WebhookEvents } from '@/lib/webhook';

// GET - fetch single apartment (public)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const apartment = await db.apartment.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true },
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

// SECURITY: Removed PATCH - was completely unauthenticated

// PUT - update apartment (DEVELOPER only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Require developer authentication
  const { auth, errorResponse } = await requireDeveloper(request);
  if (errorResponse || !auth) return errorResponse!;

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

    if (body.action === 'approve') {
      updateData = {
        status: 'available',
        approvedBy: 'developer',
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

    try { await broadcastEvent(WebhookEvents.APARTMENTS_CHANGED); } catch {}

    return NextResponse.json({ success: true, apartment });
  } catch (error) {
    console.error('Error updating apartment:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// DELETE - delete apartment (DEVELOPER only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // SECURITY: Require developer authentication
  const { auth, errorResponse } = await requireDeveloper(request);
  if (errorResponse || !auth) return errorResponse!;

  try {
    const { id } = await params;

    await db.payment.deleteMany({ where: { inquiry: { apartmentId: id } } });
    await db.inquiry.deleteMany({ where: { apartmentId: id } });
    await db.apartment.delete({ where: { id } });

    try { await broadcastEvent(WebhookEvents.APARTMENTS_CHANGED); } catch {}

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting apartment:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
