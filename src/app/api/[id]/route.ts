import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/auth';

const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com';

async function authenticateRequest(request: NextRequest): Promise<{ userId: string; role?: string; identifier?: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  try {
    return verify(token, JWT_SECRET) as { userId: string; role?: string; identifier?: string };
  } catch {
    return null;
  }
}

async function isDeveloper(request: NextRequest): Promise<boolean> {
  const auth = await authenticateRequest(request);
  if (!auth) return false;
  if (auth.role === 'DEVELOPER' || auth.identifier === DEVELOPER_EMAIL) return true;
  try {
    const user = await db.user.findUnique({ where: { id: auth.userId }, select: { role: true, identifier: true } });
    return user?.role === 'DEVELOPER' || user?.identifier === DEVELOPER_EMAIL;
  } catch { return false; }
}

async function isOwnerOrDeveloper(request: NextRequest, apartmentId: string): Promise<boolean> {
  const auth = await authenticateRequest(request);
  if (!auth) return false;
  // Check developer
  if (auth.role === 'DEVELOPER' || auth.identifier === DEVELOPER_EMAIL) return true;
  try {
    const user = await db.user.findUnique({ where: { id: auth.userId }, select: { role: true, identifier: true } });
    if (user?.role === 'DEVELOPER' || user?.identifier === DEVELOPER_EMAIL) return true;
  } catch { /* continue */ }
  // Check owner
  try {
    const apartment = await db.apartment.findUnique({ where: { id: apartmentId }, select: { userId: true } });
    return apartment?.userId === auth.userId;
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
          // Exclude email and phone for unauthenticated users
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
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;

    // Authorization: must be owner or developer
    const authorized = await isOwnerOrDeveloper(request, id);
    if (!authorized) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

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
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;

    // Authorization: must be owner or developer
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
    // PATCH requires DEVELOPER authentication
    const dev = await isDeveloper(request);
    if (!dev) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

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
