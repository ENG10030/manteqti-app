import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { sendOTPEmail } from '@/lib/email';
import { checkRateLimit, recordFailedAttempt } from '@/lib/rate-limit';

export const dynamic = "force-dynamic";

// إرسال طلب استعادة كلمة المرور - OTP-based flow
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'البريد الإلكتروني مطلوب' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 🔒 Database-backed rate limiting (works across all serverless instances)
    if (!(await checkRateLimit("forgot-password", "email", normalizedEmail))) {
      return NextResponse.json({ 
        error: 'طلبات كثيرة. حاول بعد 30 دقيقة' 
      }, { status: 429 });
    }

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
      // 🔒 سجل المحاولة حتى لو البريد مش موجود (لمنع enumeration)
      await recordFailedAttempt("forgot-password", "email", normalizedEmail, request, "Email not found in system");
      return NextResponse.json({
        success: true,
        message: 'إذا كان البريد مسجل، ستصلك رسالة لاستعادة كلمة المرور'
      });
    }

    // إنشاء رمز OTP مكون من 6 أرقام
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 دقيقة

    // حفظ الرمز في حقل passwordResetToken
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
    } catch (err: unknown) {
      console.error('Error sending reset OTP email:', err);
    }

    return NextResponse.json({
      success: true,
      message: emailSent 
        ? 'تم إرسال رمز الاستعادة إلى بريدك الإلكتروني ✅' 
        : 'إذا كان البريد مسجل، ستصلك رسالة لاستعادة كلمة المرور',
    });

  } catch (error) {
    console.error('Error in forgot password:', error);
    return NextResponse.json({ error: 'حدث خطأ. يرجى المحاولة مرة أخرى.' }, { status: 500 });
  }
}
