import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }
    let decoded: any;
    try {
      decoded = verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

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
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }
    let decoded: any;
    try {
      decoded = verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    if (decoded.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

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
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }
    let decoded: any;
    try {
      decoded = verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    if (decoded.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const { id } = await params;
    const data = await request.json();

    // Handle resend action - reset payment to Pending so user can pay again
    if (data.action === 'resend') {
      const payment = await db.payment.findUnique({ where: { id } });
      if (!payment) {
        return NextResponse.json({ error: 'الدفعة غير موجودة' }, { status: 404 });
      }

      const updatedPayment = await db.payment.update({
        where: { id },
        data: {
          status: 'Pending',
          inquiryStatus: 'new',
          transactionRef: null,
          paymentLink: null,
        }
      });

      // Also reset the inquiry status
      if (payment.inquiryId) {
        await db.inquiry.update({
          where: { id: payment.inquiryId },
          data: { lifecycleStatus: 'new' }
        });
      }

      console.log('[RESEND PAYMENT]', id, 'reset to Pending');
      return NextResponse.json({
        message: 'تم إعادة إرسال طلب الدفع',
        id: updatedPayment.id,
        status: updatedPayment.status
      });
    }

    // Default: status update
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
