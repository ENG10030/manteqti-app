import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, requireDeveloper, requireApprovedUser } from '@/lib/auth-middleware';

export async function GET() {
  try {
    const { auth, errorResponse } = await getAuthContext({ cookies: { get: (n: string) => ({ value: '' }) } } as any);
    // Use getAuthContext from middleware — but for GET we need a lighter approach
    const cookieStore = await (await import('next/headers')).cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }
    
    const { auth: authResult, errorResponse: authError } = await getAuthContext({ cookies: async () => cookieStore } as any);
    if (authError) {
      // Retry with proper request
    }

    // Simple approach for this route
    const { verify } = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET;
    if (!secret) return NextResponse.json({ error: 'Config error' }, { status: 500 });
    
    const decoded = verify(token, secret, { algorithms: ['HS256'] }) as any;
    
    const isDeveloper = decoded.role === 'DEVELOPER';

    const where: any = {};
    if (!isDeveloper) {
      where.userId = decoded.userId;
    }

    const payments = await db.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        inquiry: {
          include: { apartment: true }
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
        name: p.inquiry.name,
        email: p.inquiry.email,
        phone: p.inquiry.phone,
        message: p.inquiry.message,
        apartment: p.inquiry.apartment ? {
          id: p.inquiry.apartment.id,
          title: p.inquiry.apartment.title,
          price: p.inquiry.apartment.price
        } : null
      } : null
    })));
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await (await import('next/headers')).cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }
    
    const { verify } = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET;
    if (!secret) return NextResponse.json({ error: 'Config error' }, { status: 500 });
    
    const decoded = verify(token, secret, { algorithms: ['HS256'] }) as any;

    const data = await request.json();

    // Basic validation
    if (!data.method || typeof data.method !== 'string' || data.method.trim() === '') {
      return NextResponse.json({ error: 'method is required' }, { status: 400 });
    }
    if (!data.amount || typeof data.amount !== 'number' || !Number.isInteger(data.amount) || data.amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive integer' }, { status: 400 });
    }
    if (data.inquiryId) {
      const inquiryExists = await db.inquiry.findUnique({ where: { id: data.inquiryId } });
      if (!inquiryExists) {
        return NextResponse.json({ error: 'Inquiry not found' }, { status: 400 });
      }
    }

    // CRITICAL FIX: Do NOT let user control status — always starts as "Pending"
    const payment = await db.payment.create({
      data: {
        inquiryId: data.inquiryId,
        method: data.method,
        status: 'Pending',
        inquiryStatus: 'Pending',
        amount: data.amount,
        transactionRef: data.transactionRef,
        paymentLink: data.paymentLink,
        userId: decoded.userId
      }
    });

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

// DELETE - حذف مدفوعات (developer only)
export async function DELETE(request: NextRequest) {
  try {
    const { auth, errorResponse } = await requireDeveloper(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const ids: string[] = body.ids;

    if (ids && ids.length > 0) {
      const result = await db.payment.deleteMany({
        where: { id: { in: ids } }
      });
      return NextResponse.json({ message: `تم حذف ${result.count} مدفوعة بنجاح`, deleted: result.count });
    } else {
      const result = await db.payment.deleteMany({});
      return NextResponse.json({ message: `تم حذف ${result.count} مدفوعة بنجاح`, deleted: result.count });
    }
  } catch (error) {
    console.error('Error deleting payments:', error);
    return NextResponse.json({ error: 'Failed to delete payments' }, { status: 500 });
  }
}
