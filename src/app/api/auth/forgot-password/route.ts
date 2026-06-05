import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '@/lib/email';
import bcrypt from 'bcryptjs';

// Rate limiting for forgot-password requests
const forgotCounts = new Map<string, { count: number; lastRequest: number }>();
const MAX_FORGET_REQUESTS = 3;
const FORGET_WINDOW = 10 * 60 * 1000; // 10 minutes

// إرسال طلب استعادة كلمة المرور
export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const now = Date.now();
    const fCount = forgotCounts.get(clientIp);
    if (fCount) {
      if (now - fCount.lastRequest < FORGET_WINDOW) {
        if (fCount.count >= MAX_FORGET_REQUESTS) {
          return NextResponse.json({ error: 'طلبات كثيرة. يرجى المحاولة بعد 10 دقائق' }, { status: 429 });
        }
        fCount.count += 1;
        fCount.lastRequest = now;
      } else {
        forgotCounts.set(clientIp, { count: 1, lastRequest: now });
      }
    } else {
      forgotCounts.set(clientIp, { count: 1, lastRequest: now });
    }

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

    // Generate a secure random 6-digit OTP for password reset
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

    // 📧 Send dedicated password reset email (not the OTP template)
    let emailSent = false;
    try {
      if (!process.env.RESEND_API_KEY) {
        console.error('⚠️ RESEND_API_KEY is not set! Password reset emails cannot be sent.');
      } else {
        const result = await sendPasswordResetEmail({ to: normalizedEmail, otp: otpCode, name: user.name });
        emailSent = result.success;
        if (!emailSent) {
          console.error('Password reset email failed:', result.error);
        }
      }
    } catch (err: any) {
      // Silently fail to not leak info, but log
      console.error('Password reset email exception:', err?.message);
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
