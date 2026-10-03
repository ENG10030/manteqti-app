import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApprovedUser, getAuthContext } from '@/lib/auth-middleware';

// Inquiries API

export async function GET(request: NextRequest) {
  try {
    const { auth, errorResponse } = await getAuthContext(request);
    if (!auth) return errorResponse!;

    if (auth.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const inquiries = await db.inquiry.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        apartment: true,
        payment: true
      }
    });

    return NextResponse.json(inquiries.map(inq => ({
      id: inq.id,
      apartmentId: inq.apartmentId,
      userId: inq.userId,
      name: inq.name,
      email: inq.email,
      phone: inq.phone,
      message: inq.message,
      lifecycleStatus: inq.lifecycleStatus,
      createdAt: inq.createdAt.toISOString(),
      apartment: inq.apartment ? {
        id: inq.apartment.id,
        title: inq.apartment.title,
        price: inq.apartment.price,
        type: inq.apartment.type,
        status: inq.apartment.status
      } : null,
      payment: inq.payment ? {
        id: inq.payment.id,
        status: inq.payment.status,
        method: inq.payment.method
      } : null
    })));
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    return NextResponse.json({ error: 'Failed to fetch inquiries' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { auth, errorResponse } = await requireApprovedUser(request);
    if (!auth) return errorResponse!;

    const data = await request.json();

    // ⛔ SECURITY: تعقيم + حدود طول — كانت الحقول تتخزن خام (XSS مخزّن في لوحة الإدارة + تضخيم DB)
    const cleanText = (v: unknown, max: number): string =>
      typeof v === 'string' ? v.replace(/<[^>]*>/g, '').trim().slice(0, max) : '';
    const cleanName = cleanText(data.name, 100);
    const cleanEmail = cleanText(data.email, 254);
    const cleanPhone = cleanText(data.phone, 30);
    const cleanMessage = cleanText(data.message, 2000);
    if (!cleanName || !cleanMessage) {
      return NextResponse.json({ error: 'الاسم والرسالة مطلوبان' }, { status: 400 });
    }

    const inquiry = await db.inquiry.create({
      data: {
        apartmentId: String(data.apartmentId || '').slice(0, 40),
        userId: auth.userId,
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        message: cleanMessage,
        lifecycleStatus: 'New'
      },
      include: {
        apartment: true
      }
    });

    return NextResponse.json({
      id: inquiry.id,
      apartmentId: inquiry.apartmentId,
      userId: inquiry.userId,
      name: inquiry.name,
      email: inquiry.email,
      phone: inquiry.phone,
      message: inquiry.message,
      lifecycleStatus: inquiry.lifecycleStatus,
      createdAt: inquiry.createdAt.toISOString()
    });
  } catch (error) {
    console.error('Error creating inquiry:', error);
    return NextResponse.json({ error: 'Failed to create inquiry' }, { status: 500 });
  }
}
