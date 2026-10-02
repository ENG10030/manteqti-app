import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApprovedUser, requireDeveloper, getAuthContext } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const { auth, errorResponse } = await getAuthContext(request);
    if (!auth) return errorResponse!;

    const isDeveloper = auth.role === 'DEVELOPER';

    // المطور يرى كل المدفوعات، المستخدم العادي يرى مدفوعاته فقط
    const where: any = {};
    if (!isDeveloper) {
      where.userId = auth.userId;
    }

    const payments = await db.payment.findMany({
      where,
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

export async function POST(request: NextRequest) {
  try {
    const { auth, errorResponse } = await requireApprovedUser(request);
    if (!auth) return errorResponse!;

    const data = await request.json();

    // ⛔ SECURITY: الحالة والمبلغ يُحددان من السيرفر دائماً — قبول status من العميل كان
    // بيسمح بتجاوز جدار الدفع (Paid فوراً بدون فلوس). الاعتماد بيتعمل من المطور/الويبهوك فقط.
    // المسار الشرعي الوحيد لـ "Paid" فوراً: الرسوم = 0 في الإعدادات (تواصل مجاني).
    // كمان لازم الـ inquiry يخص المستخدم نفسه (يمنع إنشاء مدفوعات على استفسارات غيره)
    if (!data.inquiryId || typeof data.inquiryId !== 'string') {
      return NextResponse.json({ error: 'معرّف الاستفسار مطلوب' }, { status: 400 });
    }
    const inquiry = await db.inquiry.findUnique({ where: { id: data.inquiryId }, select: { id: true, userId: true } });
    if (!inquiry) {
      return NextResponse.json({ error: 'الاستفسار غير موجود' }, { status: 404 });
    }
    if (inquiry.userId && inquiry.userId !== auth.userId) {
      return NextResponse.json({ error: 'غير مصرح لك' }, { status: 403 });
    }

    const settings = await db.settings.findFirst({ select: { contactFee: true } });
    const fee = settings?.contactFee ?? 0;
    const status = fee === 0 ? 'Paid' : 'Pending'; // المجاني يُعتمد تلقائياً، المفلوس يستنى المطور

    const payment = await db.payment.create({
      data: {
        inquiryId: data.inquiryId,
        method: typeof data.method === 'string' ? data.method.slice(0, 50) : null,
        status,
        inquiryStatus: 'Pending',
        amount: fee, // مصدر الحقيقة = الإعدادات، مش رقم العميل
        transactionRef: typeof data.transactionRef === 'string' ? data.transactionRef.slice(0, 200) : null,
        paymentLink: typeof data.paymentLink === 'string' ? data.paymentLink.slice(0, 500) : null,
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
// Body: { ids: string[] } لحذف محددة, أو {} لحذف الكل
export async function DELETE(request: NextRequest) {
  try {
    const { auth, errorResponse } = await requireDeveloper(request);
    if (!auth) return errorResponse!;

    const body = await request.json();
    const ids: string[] = body.ids;

    if (ids && ids.length > 0) {
      // حذف مدفوعات محددة
      const result = await db.payment.deleteMany({
        where: { id: { in: ids } }
      });
      return NextResponse.json({ message: `تم حذف ${result.count} مدفوعة بنجاح`, deleted: result.count });
    } else {
      // حذف جميع المدفوعات
      const result = await db.payment.deleteMany({});
      return NextResponse.json({ message: `تم حذف ${result.count} مدفوعة بنجاح`, deleted: result.count });
    }
  } catch (error) {
    console.error('Error deleting payments:', error);
    return NextResponse.json({ error: 'Failed to delete payments' }, { status: 500 });
  }
}