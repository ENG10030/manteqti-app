import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendVerificationEmail } from '@/lib/email';

/**
 * توليد رمز OTP مكون من 6 أرقام
 */
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * إعادة إرسال رمز OTP
 * POST /api/auth/request-otp
 * Body: { identifier: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier } = body;

    if (!identifier) {
      return NextResponse.json({ error: 'البريد الإلكتروني مطلوب' }, { status: 400 });
    }

    const normalizedIdentifier = identifier.toLowerCase().trim();

    // البحث عن المستخدم
    const user = await db.user.findUnique({
      where: { identifier: normalizedIdentifier },
    });

    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    // التحقق من أن البريد لم يتم تأكيده بالفعل
    if (user.emailVerified) {
      return NextResponse.json({ error: 'البريد الإلكتروني مؤكد بالفعل ✅' }, { status: 400 });
    }

    // التحقق من Rate Limiting (لا يسمح بأكثر من طلب كل 60 ثانية)
    if (user.otpExpires) {
      const timeSinceLastRequest = Date.now() - user.otpExpires.getTime() + (10 * 60 * 1000); // otpExpires - 10min = time of creation
      const timeSinceCreation = (10 * 60 * 1000) - (user.otpExpires.getTime() - Date.now());
      if (timeSinceCreation > 0 && (10 * 60 * 1000 - timeSinceCreation) < 60000) {
        // أقل من دقيقة من آخر طلب
        const waitSeconds = Math.ceil((60000 - (10 * 60 * 1000 - timeSinceCreation)) / 1000);
        return NextResponse.json({
          error: `يرجى الانتظار ${waitSeconds} ثانية قبل طلب رمز جديد ⏳`
        }, { status: 429 });
      }
    }

    // توليد رمز OTP جديد
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 دقائق

    // تحديث المستخدم بالرمز الجديد
    await db.user.update({
      where: { id: user.id },
      data: {
        otp: otp,
        otpExpires: otpExpires,
      },
    });

    // ===== إرسال الإيميل =====
    let emailSent = false;

    try {
      const result = await sendVerificationEmail({
        to: user.email!,
        otp: otp,
        name: user.name,
      });
      emailSent = result.success;
      console.log(`📧 Resend OTP to ${user.email}: ${result.success ? 'SENT ✅' : 'FAILED ❌ - ' + result.error}`);
    } catch (err: any) {
      console.error('❌ Error resending OTP email:', err);
    }

    if (!emailSent) {
      return NextResponse.json({
        error: 'فشل إرسال الرمز. تأكد من أن البريد صحيح وحاول مرة أخرى.',
        ...(process.env.NODE_ENV === 'development' && { debug: { otp } }),
      }, { status: 500 });
    }

    return NextResponse.json({
      message: 'تم إرسال رمز تأكيد جديد ✅',
      ...(process.env.NODE_ENV === 'development' && { debug: { otp } }),
    });

  } catch (error) {
    console.error('❌ Error requesting OTP:', error);
    return NextResponse.json({ error: 'حدث خطأ. يرجى المحاولة مرة أخرى.' }, { status: 500 });
  }
}
