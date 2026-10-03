import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '@/lib/email';
import bcrypt from 'bcryptjs';
import { checkRateLimit, recordFailedAttempt, getClientIp } from '@/lib/rate-limit';

// إرسال طلب استعادة كلمة المرور
export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP — DB-backed (3 طلبات / 10 دقائق لكل IP)
    const clientIp = getClientIp(request);
    const allowed = await checkRateLimit("forgot-password", "ip", clientIp, 3, 10 * 60);
    if (!allowed) {
      return NextResponse.json({ error: 'طلبات كثيرة. يرجى المحاولة بعد 10 دقائق' }, { status: 429 });
    }
    await recordFailedAttempt("forgot-password", "ip", clientIp, request, "reset request");

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

    // Generate a secure random 6-digit OTP for password reset (v219)
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // ساعة واحدة

    // Hash the OTP before storing
    const hashedOtp = await bcrypt.hash(otpCode, 10);

    // حفظ الرمز المُشفر في سجل المستخدم
    await db.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedOtp,
        passwordResetExpires: expiresAt
      }
    });

    // Check RESEND_API_KEY
    if (!process.env.RESEND_API_KEY) {
      console.warn('⚠️ RESEND_API_KEY is not set. Password reset email will NOT be sent. User:', normalizedEmail);
    }

    // 📧 Send dedicated password reset email (not the OTP template)
    let emailSent = false;
    try {
      const result = await sendPasswordResetEmail({ to: normalizedEmail, otp: otpCode, name: user.name });
      emailSent = result.success;
    } catch {
      // Silently fail to not leak info
    }

    // SECURITY: Always return the same message to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: 'إذا كان البريد مسجل، ستصلك رسالة لاستعادة كلمة المرور',
    });

  } catch (error) {
    return NextResponse.json({ error: 'حدث خطأ. يرجى المحاولة مرة أخرى.' }, { status: 500 });
  }
}
