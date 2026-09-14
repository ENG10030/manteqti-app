import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { identifier } = await request.json();

    if (!identifier) {
      return NextResponse.json({ 
        error: 'البريد الإلكتروني مطلوب' 
      }, { status: 400 });
    }

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    const normalizedIdentifier = identifier.toLowerCase().trim();

    // Find user by identifier or email
    const user = await db.user.findFirst({
      where: {
        OR: [
          { identifier: normalizedIdentifier },
          { email: normalizedIdentifier }
        ]
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    // Update existing user with new OTP
    await db.user.update({
      where: { id: user.id },
      data: {
        otp,
        otpExpires
      }
    });

    // In production, send OTP via email service
    console.log(`📧 Email verification OTP for ${identifier}: ${otp}`);

    return NextResponse.json({ 
      success: true,
      message: 'تم إرسال رمز التحقق'
    });
  } catch (error) {
    console.error('Error requesting OTP:', error);
    return NextResponse.json({ error: 'فشل في إرسال رمز التحقق' }, { status: 500 });
  }
}
