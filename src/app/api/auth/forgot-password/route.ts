import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { sendOTPEmail } from '@/lib/email';

// إرسال طلب استعادة كلمة المرور
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

    // Generate a simple 6-digit OTP for password reset
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // ساعة واحدة

    // حفظ الرمز في سجل المستخدم مباشرة
    await db.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: otpCode,
        passwordResetExpires: expiresAt
      }
    });

    // إرسال الإيميل باستخدام رمز OTP
    let emailSent = false;
    try {
      const result = await sendOTPEmail({ to: normalizedEmail, otp: otpCode, name: user.name });
      emailSent = result.success;
    } catch {
      // Silently fail to not leak info
    }

    return NextResponse.json({
      success: true,
      message: emailSent 
        ? 'تم إرسال رمز الاستعادة إلى بريدك الإلكتروني ✅' 
        : 'إذا كان البريد مسجل، ستصلك رسالة لاستعادة كلمة المرور',
    });

  } catch (error) {
    return NextResponse.json({ error: 'حدث خطأ. يرجى المحاولة مرة أخرى.' }, { status: 500 });
  }
}
