import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const payment = await db.payment.findUnique({
      where: { id },
      include: {
        inquiry: {
          include: {
            apartment: true
          }
        }
      }
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
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
  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
  }
}
