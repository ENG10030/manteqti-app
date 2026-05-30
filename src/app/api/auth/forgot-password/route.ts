import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { sendOTPEmail } from '@/lib/email';

// إرسال طلب استعادة كلمة المرور - OTP-based flow
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'البريد الإلكتروني مطلوب' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // البحث عن المستخدم بهذا البريد
    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { identifier: normalizedEmail }
        ]
      }
    });

    // لأسباب أمنية، لا نكشف إذا كان البريد موجود أم لا
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'إذا كان البريد مسجل، ستصلك رسالة لاستعادة كلمة المرور'
      });
    }

    // إنشاء رمز OTP مكون من 6 أرقام
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 دقيقة

    // حفظ الرمز في حقل passwordResetToken (أعد استخدامه لتخزين OTP)
    await db.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: otp,
        passwordResetExpires: expiresAt
      }
    });

    // إرسال OTP عبر الإيميل
    let emailSent = false;
    try {
      const emailTo = user.email || normalizedEmail;
      const result = await sendOTPEmail({ to: emailTo, otp, name: user.name });
      emailSent = result.success;
      console.log(`📧 Reset password OTP email result: ${JSON.stringify(result)}`);
    } catch (err: any) {
      console.error('Error sending reset OTP email:', err);
    }

    return NextResponse.json({
      success: true,
      message: emailSent 
        ? 'تم إرسال رمز الاستعادة إلى بريدك الإلكتروني ✅' 
        : 'إذا كان البريد مسجل، ستصلك رسالة لاستعادة كلمة المرور',
      ...(process.env.NODE_ENV === 'development' && { otp })
    });

  } catch (error) {
    console.error('Error in forgot password:', error);
    return NextResponse.json({ error: 'حدث خطأ. يرجى المحاولة مرة أخرى.' }, { status: 500 });
  }
}
