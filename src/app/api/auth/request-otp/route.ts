import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomInt } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { identifier } = await request.json();

    if (!identifier) {
      return NextResponse.json({ error: 'Identifier is required' }, { status: 400 });
    }

    // Generate 6-digit OTP
    const otp = randomInt(100000, 999999).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Check if user exists
    let user = await db.user.findUnique({
      where: { identifier }
    });

    if (user) {
      // Update existing user with new OTP
      user = await db.user.update({
        where: { identifier },
        data: { otp, otpExpires }
      });
    } else {
      // Create new user with OTP
      user = await db.user.create({
        data: {
          identifier,
          name: identifier.split('@')[0] || 'User',
          otp,
          otpExpires
        }
      });
    }

    // In production, send OTP via email/SMS
    // For demo, log to console
    console.log(`[OTP] Code for ${identifier}: ${otp}`);

    return NextResponse.json({ 
      success: true, 
      message: 'OTP sent successfully',
      // In development, return the OTP for testing
      ...(process.env.NODE_ENV !== 'production' && { otp })
    });
  } catch (error) {
    console.error('Error requesting OTP:', error);
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}
