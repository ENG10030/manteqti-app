import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, requireDeveloper } from '@/lib/auth-middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { auth, errorResponse } = await getAuthContext(request);
    if (errorResponse || !auth) return errorResponse!;

    const { id } = await params;
    
    const payment = await db.payment.findUnique({
      where: { id },
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

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // SECURITY: Ownership check - users can only see own payments
    if (auth.role !== 'DEVELOPER' && payment.userId !== auth.userId) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    return NextResponse.json({
      id: payment.id,
      inquiryId: payment.inquiryId,
      method: payment.method,
      status: payment.status,
      inquiryStatus: payment.inquiryStatus,
      amount: payment.amount,
      transactionRef: payment.transactionRef,
      paymentLink: payment.paymentLink,
      userId: payment.userId,
      createdAt: payment.createdAt.toISOString(),
      inquiry: payment.inquiry ? {
        id: payment.inquiry.id,
        apartmentId: payment.inquiry.apartmentId,
        apartment: payment.inquiry.apartment
      } : null
    });
  } catch (error) {
    console.error('Error fetching payment:', error);
    return NextResponse.json({ error: 'Failed to fetch payment' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { auth, errorResponse } = await requireDeveloper(request);
  if (errorResponse || !auth) return errorResponse!;

  const { id } = await params;
  const data = await request.json();

  const payment = await db.payment.update({
    where: { id },
    data: {
      status: data.status,
      inquiryStatus: data.inquiryStatus
    }
  });

  return NextResponse.json({
    id: payment.id,
    status: payment.status,
    inquiryStatus: payment.inquiryStatus
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { auth, errorResponse } = await requireDeveloper(request);
  if (errorResponse || !auth) return errorResponse!;

  const { id } = await params;
  const data = await request.json();

  const payment = await db.payment.update({
    where: { id },
    data: {
      status: data.status,
      inquiryStatus: data.inquiryStatus
    }
  });

  return NextResponse.json({
    id: payment.id,
    status: payment.status,
    inquiryStatus: payment.inquiryStatus
  });
}
