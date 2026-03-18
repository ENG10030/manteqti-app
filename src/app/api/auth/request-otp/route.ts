import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomBytes, createHash } from 'crypto';

// Hash password with SHA-256
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

// Generate random OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const { identifier } = await request.json();

    if (!identifier) {
      return NextResponse.json({ 
        error: 'البريد الإلكتروني أو رقم الهاتف مطلوب' 
      }, { status: 400 });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Check if user exists
    let user = await db.user.findUnique({
      where: { identifier }
    });

    if (user) {
      // Update existing user with OTP
      user = await db.user.update({
        where: { identifier },
        data: {
          otp,
          otpExpires
        }
      });
    } else {
      // Create new user with OTP and a random default password
      const randomPassword = randomBytes(16).toString('hex');
      const hashedPassword = hashPassword(randomPassword);
      
      user = await db.user.create({
        data: {
          identifier,
          name: identifier.split('@')[0] || 'User',
          password: hashedPassword,
          otp,
          otpExpires
        }
      });
    }

    // In production, send OTP via email/SMS
    console.log(`OTP for ${identifier}: ${otp}`);

    return NextResponse.json({ 
      success: true,
      message: 'تم إرسال رمز التحقق',
      // In development, return OTP for testing
      ...(process.env.NODE_ENV === 'development' && { otp })
    });
  } catch (error) {
    console.error('Error requesting OTP:', error);
    return NextResponse.json({ error: 'فشل في إرسال رمز التحقق' }, { status: 500 });
  }
}
