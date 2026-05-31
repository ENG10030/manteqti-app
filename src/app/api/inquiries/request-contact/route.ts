import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "";

export async function POST(request: NextRequest) {
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

    const data = await request.json();
    const { apartmentId, name, email, phone, message } = data;

    if (!apartmentId || !name || !email || !phone) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 });
    }

    // جلب الشقق للتحقق من وجودها
    const apartment = await db.apartment.findUnique({
      where: { id: apartmentId },
    });

    if (!apartment) {
      return NextResponse.json({ error: 'الشقة غير موجودة' }, { status: 404 });
    }

    // التحقق من رسوم التواصل - لو 0 يتم الموافقة تلقائياً
    const settings = await db.settings.findFirst();
    const contactFee = settings?.contactFee ?? 50;

    const inquiry = await db.inquiry.create({
      data: {
        apartmentId,
        userId: decoded.userId || null,
        name,
        email,
        phone,
        message: message || '',
        lifecycleStatus: contactFee === 0 ? 'approved' : 'new',
      },
      include: {
        apartment: true,
      },
    });

    // لو الرسوم = 0، أنشئ مدفوعة تلقائية بموافقة
    if (contactFee === 0) {
      await db.payment.create({
        data: {
          inquiryId: inquiry.id,
          method: 'free',
          status: 'Paid',
          amount: 0,
          userId: decoded.userId || null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      inquiry: {
        id: inquiry.id,
        apartmentId: inquiry.apartmentId,
        name: inquiry.name,
        email: inquiry.email,
        phone: inquiry.phone,
        message: inquiry.message,
        lifecycleStatus: inquiry.lifecycleStatus,
        isFree: contactFee === 0,
        contactFee,
        createdAt: inquiry.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating contact request:', error);
    return NextResponse.json({ error: 'حدث خطأ في إرسال طلب التواصل' }, { status: 500 });
  }
}
