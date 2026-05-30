import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth, requireDeveloper } from '@/lib/auth';

/**
 * GET /api/payments
 * Require auth. Return payments where userId matches current user (or all if developer).
 */
export async function GET(request: NextRequest) {
  try {
    const decoded = await verifyAuth(request);
    if (!decoded) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    // Developer sees all payments with relations
    if (decoded.role === 'DEVELOPER') {
      const payments = await db.payment.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          inquiry: {
            include: {
              apartment: { select: { id: true, title: true, price: true } },
            },
          },
          user: { select: { id: true, name: true, identifier: true } },
        },
      });
      return NextResponse.json(payments);
    }

    // Regular user sees only their own payments
    const payments = await db.payment.findMany({
      where: { userId: decoded.id },
      orderBy: { createdAt: 'desc' },
      include: {
        inquiry: {
          include: {
            apartment: { select: { id: true, title: true, price: true } },
          },
        },
      },
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * POST /api/payments
 * Require auth. Create payment record. Verify inquiry exists.
 */
export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyAuth(request);
    if (!decoded) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const body = await request.json();
    const { inquiryId, method, amount, status = 'Pending' } = body;

    if (!inquiryId || !method) {
      return NextResponse.json({ error: 'بيانات الدفع مطلوبة' }, { status: 400 });
    }

    // Verify the inquiry exists
    const inquiry = await db.inquiry.findUnique({
      where: { id: inquiryId },
    });

    if (!inquiry) {
      return NextResponse.json({ error: 'الاستفسار غير موجود' }, { status: 404 });
    }

    const payment = await db.payment.create({
      data: {
        inquiryId,
        userId: decoded.id,
        method,
        amount: amount || 0,
        status,
      },
      include: {
        inquiry: {
          include: {
            apartment: { select: { id: true, title: true, price: true } },
          },
        },
      },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء الدفع' }, { status: 500 });
  }
}
