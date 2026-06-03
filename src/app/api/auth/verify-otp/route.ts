import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sign } from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// OTP attempt rate limiting (in-memory)
const otpAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_OTP_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

export async function POST(request: NextRequest) {
  try {
    const { identifier, otp, code } = await request.json();

    // Accept either 'otp' or 'code' field
    const otpCode = otp || code;

    if (!identifier || !otpCode) {
      return NextResponse.json({ error: 'البريد الإلكتروني والرمز مطلوبان' }, { status: 400 });
    }

    const normalizedIdentifier = identifier.toLowerCase().trim();

    // Check rate limiting for OTP attempts
    const attempt = otpAttempts.get(normalizedIdentifier);
    if (attempt) {
      if (attempt.lockedUntil && Date.now() < attempt.lockedUntil) {
        const remainingMinutes = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
        return NextResponse.json({ 
          error: `تم تجاوز عدد المحاولات المسموح. يرجى المحاولة بعد ${remainingMinutes} دقيقة`,
          tooManyAttempts: true 
        }, { status: 429 });
      }
      if (attempt.count >= MAX_OTP_ATTEMPTS) {
        // Lock for 15 minutes
        otpAttempts.set(normalizedIdentifier, { count: attempt.count, lockedUntil: Date.now() + LOCKOUT_DURATION });
        return NextResponse.json({ 
          error: 'تم تجاوز عدد المحاولات المسموح. يرجى المحاولة بعد 15 دقيقة',
          tooManyAttempts: true 
        }, { status: 429 });
      }
    }

    // Find user by identifier
    const user = await db.user.findFirst({
      where: {
        OR: [
          { identifier: normalizedIdentifier },
          { email: normalizedIdentifier }
        ]
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'البريد الإلكتروني أو الرمز غير صحيح' }, { status: 400 });
    }

    // Check expiry BEFORE checking OTP value
    if (!user.otpExpires || user.otpExpires < new Date()) {
      return NextResponse.json({ error: 'انتهت صلاحية الرمز' }, { status: 400 });
    }

    // Use bcrypt.compare for OTP verification (since we now hash it)
    const isOtpValid = await bcrypt.compare(otpCode, user.otp);

    if (!isOtpValid) {
      // Increment attempt counter
      const currentAttempt = otpAttempts.get(normalizedIdentifier) || { count: 0, lockedUntil: 0 };
      currentAttempt.count += 1;
      otpAttempts.set(normalizedIdentifier, currentAttempt);

      const remaining = MAX_OTP_ATTEMPTS - currentAttempt.count;
      if (remaining <= 0) {
        otpAttempts.set(normalizedIdentifier, { count: currentAttempt.count, lockedUntil: Date.now() + LOCKOUT_DURATION });
        return NextResponse.json({ 
          error: 'تم تجاوز عدد المحاولات المسموح. يرجى المحاولة بعد 15 دقيقة',
          tooManyAttempts: true 
        }, { status: 429 });
      }

      return NextResponse.json({ 
        error: `رمز التأكيد غير صحيح. متبقي ${remaining} محاول${remaining === 1 ? 'ة' : 'ات'}`,
        remainingAttempts: remaining 
      }, { status: 400 });
    }

    // Clear attempt counter on success
    otpAttempts.delete(normalizedIdentifier);

    // Mark email as verified and clear OTP
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        otp: null,
        otpExpires: null,
        emailVerified: true,
      }
    });

    // Generate JWT token and set auth-token cookie (same as login)
    const token = sign(
      { userId: updatedUser.id, identifier: updatedUser.identifier, role: updatedUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const response = NextResponse.json({
      message: 'تم تأكيد البريد الإلكتروني بنجاح',
      user: {
        id: updatedUser.id,
        identifier: updatedUser.identifier,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        emailVerified: true,
      }
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'فشل في التحقق من الرمز' }, { status: 500 });
  }
}
