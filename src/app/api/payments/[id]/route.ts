import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDeveloper } from '@/lib/auth';

/**
 * PUT /api/payments/[id]
 * Require developer auth. Update payment status.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const decoded = await requireDeveloper(request);
    if (decoded instanceof Response) return decoded;

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: 'حالة الدفع مطلوبة' }, { status: 400 });
    }

    const existingPayment = await db.payment.findUnique({
      where: { id },
    });

    if (!existingPayment) {
      return NextResponse.json({ error: 'الدفعة غير موجودة' }, { status: 404 });
    }

    const payment = await db.payment.update({
      where: { id },
      data: { status },
    });

    // Log payment status update
    try {
      await db.operationLog.create({
        data: {
          action: 'PAYMENT_STATUS_UPDATED',
          entityType: 'Payment',
          entityId: payment.id,
          details: JSON.stringify({
            paymentId: payment.id,
            oldStatus: existingPayment.status,
            newStatus: status,
            updatedBy: decoded.identifier,
          }),
          userId: decoded.id,
        },
      });
    } catch {}

    return NextResponse.json(payment);
  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
