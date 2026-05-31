import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext, requireDeveloper, requireApprovedUser } from '@/lib/auth-middleware';

function sanitizeString(str: unknown): string {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>&"']/g, '').trim().slice(0, 500);
}

export async function GET() {
  try {
    const cookieStore = await (await import('next/headers')).cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }

    const { auth } = await getAuthContext({ cookies: async () => cookieStore } as any);
    if (!auth) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const isDeveloper = auth.role === 'DEVELOPER';

    const where: any = {};
    if (!isDeveloper) {
      where.userId = auth.userId;
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
    const { auth, errorResponse } = await getAuthContext(request);
    if (errorResponse) return errorResponse;
    if (!auth) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });

    const approved = await requireApprovedUser(request);
    if (approved.errorResponse) return approved.errorResponse;

    const data = await request.json();

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

    const payment = await db.payment.create({
      data: {
        inquiryId: data.inquiryId,
        method: sanitizeString(data.method),
        status: 'Pending',
        inquiryStatus: 'Pending',
        amount: data.amount,
        transactionRef: sanitizeString(data.transactionRef),
        paymentLink: sanitizeString(data.paymentLink),
        userId: auth.userId
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

    // CRITICAL FIX: Require non-empty ids array — prevent deleting ALL payments
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'يجب تحديد المدفوعات المراد حذفها (ids مطلوب)' },
        { status: 400 }
      );
    }

    const validIds = ids.filter(id => typeof id === 'string' && id.length > 0);
    if (validIds.length === 0) {
      return NextResponse.json({ error: 'لا توجد معرفات صالحة' }, { status: 400 });
    }

    const result = await db.payment.deleteMany({
      where: { id: { in: validIds } }
    });
    return NextResponse.json({ message: `تم حذف ${result.count} مدفوعة بنجاح`, deleted: result.count });
  } catch (error) {
    console.error('Error deleting payments:', error);
    return NextResponse.json({ error: 'Failed to delete payments' }, { status: 500 });
  }
}
