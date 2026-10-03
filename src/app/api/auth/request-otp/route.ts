import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendOTPEmail } from '@/lib/email';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { checkRateLimit, recordFailedAttempt } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const { identifier } = await request.json();

    if (!identifier) {
      return NextResponse.json({ 
        error: 'البريد الإلكتروني مطلوب' 
      }, { status: 400 });
    }

    const normalizedIdentifier = identifier.toLowerCase().trim();

    // ⛔ SECURITY: طلبات الرمز محسوبة في DB — 3 طلبات / 5 دقائق لكل بريد
    const allowed = await checkRateLimit("request-otp", "email", normalizedIdentifier, 3, 5 * 60);
    if (!allowed) {
      return NextResponse.json({ 
        error: 'طلبات كثيرة. يرجى المحاولة بعد 5 دقائق' 
      }, { status: 429 });
    }
    await recordFailedAttempt("request-otp", "email", normalizedIdentifier, request, "otp request");

    // Find user by identifier or email
    const user = await db.user.findFirst({
      where: {
        OR: [
          { identifier: normalizedIdentifier },
          { email: normalizedIdentifier }
        ]
      }
    });

    // Always return the same success message to prevent email enumeration
    // Even if user doesn't exist, we return "success" to not leak info
    if (!user) {
      return NextResponse.json({ 
        success: true,
        message: 'إذا كان البريد مسجلاً، سيتم إرسال رمز التحقق' 
      });
    }

    // Generate new 6-digit OTP (v219)
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Hash OTP with bcrypt before storing
    const hashedOtp = await bcrypt.hash(otp, 10);

    // Update user with hashed OTP
    await db.user.update({
      where: { id: user.id },
      data: {
        otp: hashedOtp,
        otpExpires
      }
    });

    // Send OTP via email (send the plain OTP)
    const emailTo = user.email || normalizedIdentifier;
    await sendOTPEmail({ to: emailTo, otp, name: user.name });

    return NextResponse.json({ 
      success: true,
      message: 'تم إرسال رمز التحقق',
    });
  } catch (error) {
    return NextResponse.json({ error: 'فشل في إرسال رمز التحقق' }, { status: 500 });
  }
}
