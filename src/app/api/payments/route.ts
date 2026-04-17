import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

// Helper: get authenticated user from token
async function getAuthUser(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) return null;
    
    const decoded = verify(token, JWT_SECRET) as { userId: string; role: string };
    return { userId: decoded.userId, role: decoded.role || 'USER' };
  } catch {
    return null;
  }
}

// GET - جلب المدفوعات (المطور فقط)
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }

    // ✅ Restrict GET to developers only
    if (auth.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'غير مصرح بهذا الإجراء' }, { status: 403 });
    }

    const payments = await db.payment.findMany({
      where: {},
      orderBy: { createdAt: 'desc' },
      include: {
        inquiry: {
          include: {
            apartment: true
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

// POST - إنشاء دفعة (المطور فقط أو النظام)
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }

    // Only developers can create payments
    if (auth.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const data = await request.json();

    // Validate required fields
    if (!data.inquiryId || !data.method || !data.amount) {
      return NextResponse.json({ error: 'بيانات الدفعة مطلوبة' }, { status: 400 });
    }

    // ✅ Use token userId as the payer
    const payment = await db.payment.create({
      data: {
        inquiryId: data.inquiryId,
        method: data.method,
        status: data.status || 'Pending',
        inquiryStatus: data.inquiryStatus || 'Contacted',
        amount: parseInt(data.amount) || 0,
        transactionRef: data.transactionRef || null,
        paymentLink: data.paymentLink || null,
        userId: data.userId || auth.userId
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
