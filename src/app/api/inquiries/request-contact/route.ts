import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/auth';



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

    const userId = decoded.userId;
    const body = await request.json();
    const { apartmentId, message } = body;

    if (!apartmentId) {
      return NextResponse.json({ error: 'معرف العقار مطلوب' }, { status: 400 });
    }

    // التحقق من وجود العقار
    const apartment = await db.apartment.findUnique({
      where: { id: apartmentId },
    });

    if (!apartment) {
      return NextResponse.json({ error: 'العقار غير موجود' }, { status: 404 });
    }

    // التحقق من أن المستخدم غير محظور
    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.isBlocked) {
      return NextResponse.json({ error: 'تم حظر حسابك' }, { status: 403 });
    }

    // التحقق من وجود طلب سابق لنفس المستخدم لنفس العقار
    const existingInquiry = await db.inquiry.findFirst({
      where: {
        apartmentId,
        userId,
      },
      include: { payment: true }
    });

    if (existingInquiry) {
      // إذا كان الطلب موجود ومعتمد (Contacted أو Paid)
      if (existingInquiry.lifecycleStatus === 'Contacted' ||
          existingInquiry.payment?.status === 'Paid') {
        return NextResponse.json({
          message: 'بيانات التواصل متاحة لك بالفعل',
          alreadyApproved: true,
          inquiryId: existingInquiry.id,
        });
      }

      // إذا كان الطلب موجود ومعلق
      return NextResponse.json({
        message: 'لديك طلب معلق بالفعل. سيتم الرد عليك قريباً',
        pendingInquiry: true,
        inquiryId: existingInquiry.id,
      });
    }

    // إنشاء طلب جديد
    const inquiry = await db.inquiry.create({
      data: {
        apartmentId,
        userId,
        name: user.name,
        email: user.email || user.identifier,
        phone: user.phone || '',
        message: message || `طلب بيانات التواصل للعقار: ${apartment.title} في ${apartment.area}`,
        lifecycleStatus: 'New'
      },
      include: {
        apartment: true
      }
    });

    // إرسال رسالة تلقائية للمطور مع تفاصيل الطلب
    const devMessage = `📩 طلب بيانات تواصل جديد\n\n👤 المستخدم: ${user.name}\n📧 الإيميل: ${user.email || user.identifier}\n🏠 العقار: ${apartment.title}\n📍 المنطقة: ${apartment.area}\n💰 السعر: ${apartment.price.toLocaleString()} ج.م\n${message ? `\n💬 رسالة: ${message}` : ''}\n\n→ يمكنك الموافقة على الطلب من لوحة التحكم أو الرد على المستخدم برسالة تحتوي على طريقة الدفع`;

    await db.message.create({
      data: {
        senderId: userId,
        receiverId: null, // null = للمطور
        content: devMessage,
      }
    });

    return NextResponse.json({
      message: 'تم إرسال طلب بيانات التواصل بنجاح! سيتم الرد عليك برسالة تحتوي على طريقة الدفع',
      inquiryId: inquiry.id,
      inquiry: {
        id: inquiry.id,
        apartmentId: inquiry.apartmentId,
        lifecycleStatus: inquiry.lifecycleStatus,
        createdAt: inquiry.createdAt.toISOString(),
        apartment: {
          id: inquiry.apartment.id,
          title: inquiry.apartment.title,
        }
      }
    });
  } catch (error) {
    console.error('Error requesting contact:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
