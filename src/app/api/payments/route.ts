import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser(new NextRequest('http://placeholder'));
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }

    // 🔒 SECURITY: التحقق من الدور من قاعدة البيانات
    const isDev = user.role === 'DEVELOPER';

    const where: any = {};
    if (!isDev) {
      where.userId = user.id;
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
      createdAt: p.createdAt.toISOString(),
      inquiry: p.inquiry ? {
        id: p.inquiry.id,
        apartmentId: p.inquiry.apartmentId,
        apartment: p.inquiry.apartment ? {
          id: p.inquiry.apartment.id,
          title: p.inquiry.apartment.title,
          price: p.inquiry.apartment.price
        } : null
      } : null
    })));
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب المدفوعات' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }

    const data = await request.json();

    // 🔒 SECURITY: فرض status: Pending وعدم قبول status من العميل
    const payment = await db.payment.create({
      data: {
        inquiryId: data.inquiryId,
        method: data.method,
        status: 'Pending', // 🔒 دائماً Pending - لا نقبل من العميل
        inquiryStatus: 'Contacted', // 🔒 دائماً Contacted
        amount: data.amount,
        transactionRef: data.transactionRef,
        paymentLink: data.paymentLink,
        userId: user.id, // 🔒 من قاعدة البيانات - لا من الـ body
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
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء الدفعة' }, { status: 500 });
  }
}
