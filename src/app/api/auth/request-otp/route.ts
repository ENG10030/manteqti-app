import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendOTPEmail } from '@/lib/email';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Rate limiting for OTP requests (in-memory)
const otpRequestCounts = new Map<string, { count: number; lastRequest: number }>();
const MAX_OTP_REQUESTS = 3; // max 3 requests per 5 minutes
const OTP_REQUEST_WINDOW = 5 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const { identifier } = await request.json();

    if (!identifier) {
      return NextResponse.json({ 
        error: 'البريد الإلكتروني مطلوب' 
      }, { status: 400 });
    }

    const normalizedIdentifier = identifier.toLowerCase().trim();

    // Rate limit OTP requests
    const requestCount = otpRequestCounts.get(normalizedIdentifier);
    if (requestCount) {
      const now = Date.now();
      if (now - requestCount.lastRequest < OTP_REQUEST_WINDOW) {
        if (requestCount.count >= MAX_OTP_REQUESTS) {
          return NextResponse.json({ 
            error: 'طلبات كثيرة. يرجى المحاولة بعد 5 دقائق' 
          }, { status: 429 });
        }
        requestCount.count += 1;
        requestCount.lastRequest = now;
      } else {
        // Window expired, reset counter
        otpRequestCounts.set(normalizedIdentifier, { count: 1, lastRequest: now });
      }
    } else {
      otpRequestCounts.set(normalizedIdentifier, { count: 1, lastRequest: Date.now() });
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
      return NextResponse.json({ 
        success: true,
        message: 'إذا كان البريد مسجلاً، سيتم إرسال رمز التحقق' 
      });
    }

    // Generate new 6-digit OTP
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
