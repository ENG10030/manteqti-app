import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomBytes } from 'crypto';
import { sendOTPEmail } from '@/lib/email';
import { hashToken } from '@/lib/security';

// Simple in-memory rate limit for forgot-password requests
const resetAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_RESET_ATTEMPTS = 3;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

// Send password reset request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'البريد الإلكتروني مطلوب' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Rate limiting check
    const attempt = resetAttempts.get(normalizedEmail);
    if (attempt) {
      if (attempt.lockedUntil && Date.now() < attempt.lockedUntil) {
        const remainingMinutes = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
        return NextResponse.json({
          error: `تم تجاوز عدد المحاولات. يرجى المحاولة بعد ${remainingMinutes} دقيقة`
        }, { status: 429 });
      }
    }

    // Find user - don't reveal if email exists
    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { identifier: normalizedEmail }
        ]
      }
    });

    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'إذا كان البريد مسجل، ستصلك رسالة لاستعادة كلمة المرور'
      });
    }

    // Increment rate limit
    const currentAttempt = attempt || { count: 0, lockedUntil: 0 };
    currentAttempt.count += 1;
    if (currentAttempt.count >= MAX_RESET_ATTEMPTS) {
      currentAttempt.lockedUntil = Date.now() + LOCKOUT_DURATION;
      resetAttempts.set(normalizedEmail, currentAttempt);
      return NextResponse.json({
        error: `تم تجاوز عدد المحاولات. يرجى المحاولة بعد 15 دقيقة`
      }, { status: 429 });
    }
    resetAttempts.set(normalizedEmail, currentAttempt);

    // Generate secure reset token
    const rawToken = randomBytes(32).toString('hex');
    const otpCode = rawToken.substring(0, 6).toUpperCase();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // SECURITY: Hash the token before storing in database
    const hashedToken = hashToken(rawToken);

    await db.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpires: expiresAt
      }
    });

    // Send email with OTP
    try {
      await sendOTPEmail({ to: normalizedEmail, otp: otpCode, name: user.name });
    } catch (err) {
      console.error('Error sending reset email:', err);
    }

    // SECURITY: Never include the raw token in response
    return NextResponse.json({
      success: true,
      message: 'تم إرسال رمز الاستعادة إلى بريدك الإلكتروني ✅'
    });

  } catch (error) {
    console.error('Error in forgot password:', error);
    return NextResponse.json({ error: 'حدث خطأ. يرجى المحاولة مرة أخرى.' }, { status: 500 });
  }
}
