import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, requireDeveloper } from '@/lib/auth-middleware';

// Valid inquiryStatus values whitelist
const VALID_INQUIRY_STATUSES = ['Pending', 'Paid', 'Refunded', 'Contacted', 'Agreement Reached', 'Contract Signed', 'Revoked', 'Cancelled'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { auth, errorResponse } = await getAuthContext(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    
    const payment = await db.payment.findUnique({
      where: { id },
      include: {
        inquiry: {
          include: { apartment: true }
        }
      }
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (auth!.role !== 'DEVELOPER') {
      if (payment.userId !== auth!.userId) {
        return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
      }
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
        name: payment.inquiry.name,
        email: payment.inquiry.email,
        phone: payment.inquiry.phone,
        message: payment.inquiry.message,
        apartment: payment.inquiry.apartment ? {
          id: payment.inquiry.apartment.id,
          title: payment.inquiry.apartment.title,
          price: payment.inquiry.apartment.price
        } : null
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
  try {
    const { auth, errorResponse } = await requireDeveloper(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const data = await request.json();

    const validStatuses = ['Pending', 'Paid', 'Failed', 'Refunded', 'Cancelled'];
    if (data.status && !validStatuses.includes(data.status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    // HIGH FIX: Validate inquiryStatus against whitelist
    if (data.inquiryStatus && !VALID_INQUIRY_STATUSES.includes(data.inquiryStatus)) {
      return NextResponse.json({ error: 'Invalid inquiryStatus value' }, { status: 400 });
    }

    const updateData: Record<string, string> = {};
    if (data.status) updateData.status = data.status;
    if (data.inquiryStatus) updateData.inquiryStatus = data.inquiryStatus;

    const payment = await db.payment.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      id: payment.id,
      status: payment.status,
      inquiryStatus: payment.inquiryStatus
    });
  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
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
    const data = await request.json();

    const validStatuses = ['Pending', 'Paid', 'Failed', 'Refunded', 'Cancelled'];
    if (data.status && !validStatuses.includes(data.status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    // HIGH FIX: Validate inquiryStatus against whitelist
    if (data.inquiryStatus && !VALID_INQUIRY_STATUSES.includes(data.inquiryStatus)) {
      return NextResponse.json({ error: 'Invalid inquiryStatus value' }, { status: 400 });
    }

    const updateData: Record<string, string> = {};
    if (data.status) updateData.status = data.status;
    if (data.inquiryStatus) updateData.inquiryStatus = data.inquiryStatus;

    const payment = await db.payment.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      id: payment.id,
      status: payment.status,
      inquiryStatus: payment.inquiryStatus
    });
  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
  }
}
