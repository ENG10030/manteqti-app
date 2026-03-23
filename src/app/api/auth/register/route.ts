import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash, randomBytes } from 'crypto';

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const { identifier, name, password } = await request.json();

    if (!identifier || !name || !password) {
      return NextResponse.json({
        error: 'جميع الحقول مطلوبة'
      }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({
        error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
      }, { status: 400 });
    }

    if (name.length < 2) {
      return NextResponse.json({
        error: 'الاسم يجب أن يكون حرفين على الأقل'
      }, { status: 400 });
    }

    const normalizedIdentifier = identifier.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { identifier: normalizedIdentifier }
    });

    if (existingUser) {
      return NextResponse.json({
        error: 'هذا البريد/الهاتف مسجل مسبقاً'
      }, { status: 400 });
    }

    // Create user
    const hashedPassword = hashPassword(password);
    const user = await db.user.create({
      data: {
        identifier: normalizedIdentifier,
        name: name.trim(),
        password: hashedPassword,
        email: normalizedIdentifier.includes('@') ? normalizedIdentifier : null,
        phone: normalizedIdentifier.includes('@') ? null : normalizedIdentifier
      }
    });

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
    console.error('Register error:', error);
    return NextResponse.json({
      error: 'حدث خطأ في التسجيل'
    }, { status: 500 });
  }
}
