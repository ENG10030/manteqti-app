import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sign } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

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
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json({ error: 'فشل في التحقق من الرمز' }, { status: 500 });
  }
}
