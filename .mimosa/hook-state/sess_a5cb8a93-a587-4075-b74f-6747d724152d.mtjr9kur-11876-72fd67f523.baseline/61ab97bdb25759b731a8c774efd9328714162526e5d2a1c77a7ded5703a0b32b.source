import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { identifier, otp, code } = await request.json();

    // Accept either 'otp' or 'code' field
    const otpCode = otp || code;

    if (!identifier || !otpCode) {
      return NextResponse.json({ error: 'البريد الإلكتروني والرمز مطلوبان' }, { status: 400 });
    }

    const normalizedIdentifier = identifier.toLowerCase().trim();

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
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    if (user.otp !== otpCode) {
      return NextResponse.json({ error: 'رمز التأكيد غير صحيح' }, { status: 400 });
    }

    if (!user.otpExpires || user.otpExpires < new Date()) {
      return NextResponse.json({ error: 'انتهت صلاحية الرمز' }, { status: 400 });
    }

    // Clear OTP after successful verification
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        otp: null,
        otpExpires: null
      }
    });

    // Set cookie for session
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
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role
      } 
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json({ error: 'فشل في التحقق من الرمز' }, { status: 500 });
  }
}
