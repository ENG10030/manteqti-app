import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { identifier, code, name } = await request.json();

    if (!identifier || !code) {
      return NextResponse.json({ error: 'Identifier and code are required' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { identifier }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.otp !== code) {
      return NextResponse.json({ error: 'Invalid OTP code' }, { status: 400 });
    }

    if (!user.otpExpires || user.otpExpires < new Date()) {
      return NextResponse.json({ error: 'OTP has expired' }, { status: 400 });
    }

    // Update user name if provided and clear OTP
    const updatedUser = await db.user.update({
      where: { identifier },
      data: {
        name: name || user.name,
        otp: null,
        otpExpires: null
      }
    });

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set('userId', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });

    return NextResponse.json({ 
      user: { 
        id: updatedUser.id, 
        identifier: updatedUser.identifier, 
        name: updatedUser.name 
      } 
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json({ error: 'Failed to verify OTP' }, { status: 500 });
  }
}
