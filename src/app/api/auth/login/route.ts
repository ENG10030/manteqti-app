import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash, randomBytes } from 'crypto';

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const { identifier, password } = await request.json();

    if (!identifier || !password) {
      return NextResponse.json({
        error: 'يرجى إدخال البريد/الهاتف وكلمة المرور'
      }, { status: 400 });
    }

    // Find user by identifier (email or phone)
    const user = await db.user.findUnique({
      where: { identifier: identifier.trim().toLowerCase() }
    });

    if (!user) {
      return NextResponse.json({
        error: 'بيانات الدخول غير صحيحة'
      }, { status: 401 });
    }

    // Check if user is blocked
    if (user.isBlocked) {
      return NextResponse.json({
        error: 'تم حظر حسابك. يرجى التواصل مع الدعم.'
      }, { status: 403 });
    }

    // Verify password
    const hashedPassword = hashPassword(password);
    if (user.password !== hashedPassword) {
      return NextResponse.json({
        error: 'بيانات الدخول غير صحيحة'
      }, { status: 401 });
    }

    // Create session token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    // Save session
    await db.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    // Create response with cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        identifier: user.identifier,
        name: user.name,
        phone: user.phone,
        email: user.email
      }
    });

    // Set cookie
    response.cookies.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({
      error: 'حدث خطأ في تسجيل الدخول'
    }, { status: 500 });
  }
}
