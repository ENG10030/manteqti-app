import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { sign } from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/auth';

/**
 * POST /api/auth/login
 * Find user by identifier/email. Verify password with bcrypt.
 * Checks: emailVerified, isApproved, isBlocked.
 * Sets JWT cookie and returns user data.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' }, { status: 400 });
    }

    const normalizedIdentifier = identifier.toLowerCase().trim();

    // Find user by identifier or email
    const user = await db.user.findFirst({
      where: {
        OR: [
          { identifier: normalizedIdentifier },
          { email: normalizedIdentifier },
        ],
      },
    });

    if (!user || !user.password) {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    // Verify password with bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return NextResponse.json({ emailNotVerified: true, error: 'يرجى تأكيد البريد الإلكتروني أولاً' }, { status: 403 });
    }

    // Check if user is approved
    if (!user.isApproved) {
      return NextResponse.json({ notApproved: true, error: 'حسابك بانتظار موافقة الإدارة' }, { status: 403 });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return NextResponse.json({ userBlocked: true, error: 'حسابك محظور. تواصل مع الإدارة.' }, { status: 403 });
    }

    // Generate JWT token
    const token = sign(
      {
        id: user.id,
        identifier: user.identifier,
        role: user.role,
        email: user.email,
        name: user.name,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Create response with JWT cookie
    const response = NextResponse.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح ✅',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        identifier: user.identifier,
        role: user.role,
        isApproved: user.isApproved,
        emailVerified: user.emailVerified,
        isBlocked: user.isBlocked,
        phone: user.phone,
      },
    });

    // Set auth-token cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Log login
    try {
      await db.operationLog.create({
        data: {
          action: 'USER_LOGIN',
          entityType: 'User',
          entityId: user.id,
          details: JSON.stringify({ identifier: user.identifier, role: user.role }),
          userId: user.id,
        },
      });
    } catch {}

    return response;
  } catch (error) {
    console.error('Error in login:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل الدخول' }, { status: 500 });
  }
}
