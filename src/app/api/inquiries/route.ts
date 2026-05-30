import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireDeveloper } from '@/lib/auth';

/**
 * GET /api/inquiries
 * Require developer auth. Return all inquiries with relations.
 */
export async function GET(request: NextRequest) {
  try {
    const decoded = await requireDeveloper(request);
    if (decoded instanceof Response) return decoded;

    const inquiries = await db.inquiry.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        apartment: { select: { id: true, title: true, price: true, type: true } },
        user: { select: { id: true, name: true, identifier: true } },
        payments: true,
      },
    });

    return NextResponse.json(inquiries);
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * POST /api/inquiries
 * Require auth. Create inquiry for an apartment. Verify apartment exists.
 */
export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyAuth(request);
    if (!decoded) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const body = await request.json();
    const { apartmentId, name, email, phone, message } = body;

    if (!apartmentId || !name || !email || !phone || !message) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 });
    }

    // Verify apartment exists
    const apartment = await db.apartment.findUnique({
      where: { id: apartmentId },
    });

    if (!apartment) {
      return NextResponse.json({ error: 'العقار غير موجود' }, { status: 404 });
    }

    const inquiry = await db.inquiry.create({
      data: {
        apartmentId,
        userId: decoded.id,
        name,
        email: email.toLowerCase().trim(),
        phone,
        message,
        lifecycleStatus: 'new',
      },
      include: {
        apartment: { select: { id: true, title: true, price: true } },
      },
    });

    // Log inquiry creation
    try {
      await db.operationLog.create({
        data: {
          action: 'INQUIRY_CREATED',
          entityType: 'Inquiry',
          entityId: inquiry.id,
          details: JSON.stringify({
            apartmentId,
            userId: decoded.id,
            inquiryBy: decoded.identifier,
          }),
          userId: decoded.id,
        },
      });
    } catch {}

    return NextResponse.json(inquiry, { status: 201 });
  } catch (error) {
    console.error('Error creating inquiry:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء الاستفسار' }, { status: 500 });
  }
}
