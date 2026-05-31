import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendOTPEmail } from '@/lib/email';
import crypto from 'crypto';
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

    // 🔒 Database-backed rate limiting (works across all serverless instances)
    // 3 requests per 5 minutes
    if (!(await checkRateLimit("request-otp", "email", normalizedIdentifier, 3, 5 * 60))) {
      return NextResponse.json({ 
        error: 'طلبات كثيرة. يرجى المحاولة بعد 5 دقائق' 
      }, { status: 429 });
    }

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
      await recordFailedAttempt("request-otp", "email", normalizedIdentifier, request, "Email not found in system");
      return NextResponse.json({ 
        success: true,
        message: 'إذا كان البريد مسجلاً، سيتم إرسال رمز التحقق' 
      });
    }

    // Generate new OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Update user with new OTP
    await db.user.update({
      where: { id: user.id },
      data: {
        otp,
        otpExpires
      }
    });

    // Send OTP via email
    const emailTo = user.email || normalizedIdentifier;
    await sendOTPEmail({ to: emailTo, otp, name: user.name });

    return NextResponse.json({ 
      success: true,
      message: 'تم إرسال رمز التحقق',
    });
  } catch (error) {
    console.error('Error requesting OTP:', error);
    return NextResponse.json({ error: 'فشل في إرسال رمز التحقق' }, { status: 500 });
  }
}
