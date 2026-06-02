import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, requireDeveloper } from '@/lib/auth-middleware';
import { broadcastEvent, WebhookEvents } from '@/lib/webhook';

// GET - list payments (developer sees all, user sees own)
export async function GET() {
  try {
    const { auth, errorResponse } = await getAuthContext(
      new NextRequest(new URL('/api/payments', 'http://localhost'), { headers: { cookie: '' } })
    );
    
    // Try to get auth from the request context differently
    const cookieStore = await import('next/headers').then(m => m.cookies());
    const token = (await cookieStore).get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }
    
    const { verify } = await import('jsonwebtoken');
    const { JWT_SECRET } = await import('@/lib/auth');
    let decoded: any;
    try {
      decoded = verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const isDeveloper = decoded.role === 'DEVELOPER';

    // Developer sees all payments, user sees only own
    const where: any = {};
    if (!isDeveloper) {
      where.userId = decoded.userId;
    }

    const payments = await db.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        inquiry: {
          include: {
            apartment: {
              select: { id: true, title: true, price: true }
            }
          }
        }
      }
    });

    return NextResponse.json(payments.map(p => ({
      id: p.id,
      inquiryId: p.inquiryId,
      method: p.method,
      status: p.status,
      inquiryStatus: p.inquiryStatus,
      amount: p.amount,
      transactionRef: p.transactionRef,
      paymentLink: p.paymentLink,
      userId: p.userId,
      createdAt: p.createdAt.toISOString(),
      inquiry: p.inquiry ? {
        id: p.inquiry.id,
        apartmentId: p.inquiry.apartmentId,
        apartment: p.inquiry.apartment
      } : null
    })));
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

// POST - create payment
export async function POST(request: NextRequest) {
  try {
    const { auth, errorResponse } = await getAuthContext(request);
    if (errorResponse || !auth) return errorResponse!;

    const data = await request.json();

    const payment = await db.payment.create({
      data: {
        inquiryId: data.inquiryId,
        method: data.method,
        // SECURITY: Force Pending status - prevent user from self-approving
        status: 'Pending',
        inquiryStatus: 'Pending',
        amount: data.amount,
        transactionRef: data.transactionRef,
        paymentLink: data.paymentLink,
        userId: auth.userId
      }
    });

    try { await broadcastEvent(WebhookEvents.PAYMENTS_CHANGED); } catch {}
    return NextResponse.json({
      id: payment.id,
      inquiryId: payment.inquiryId,
      method: payment.method,
      status: payment.status,
      inquiryStatus: payment.inquiryStatus,
      amount: payment.amount,
      transactionRef: payment.transactionRef,
      paymentLink: payment.paymentLink,
      createdAt: payment.createdAt.toISOString()
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}

// DELETE - delete payments (developer only)
export async function DELETE(request: NextRequest) {
  const { auth, errorResponse } = await requireDeveloper(request);
  if (errorResponse || !auth) return errorResponse!;

  const body = await request.json();
  const ids: string[] = body.ids;

  if (ids && ids.length > 0) {
    const result = await db.payment.deleteMany({
      where: { id: { in: ids } }
    });
    try { await broadcastEvent(WebhookEvents.PAYMENTS_CHANGED); } catch {}
    return NextResponse.json({ message: `تم حذف ${result.count} مدفوعة بنجاح`, deleted: result.count });
  } else {
    const result = await db.payment.deleteMany({});
    try { await broadcastEvent(WebhookEvents.PAYMENTS_CHANGED); } catch {}
    return NextResponse.json({ message: `تم حذف ${result.count} مدفوعة بنجاح`, deleted: result.count });
  }
}
