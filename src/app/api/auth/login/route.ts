import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomBytes, createHash } from 'crypto';

// Hash password with SHA-256
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const { identifier, password } = await request.json();

    if (!identifier || !password) {
      return NextResponse.json({ 
        error: 'البريد/الهاتف وكلمة المرور مطلوبان' 
      }, { status: 400 });
    }

    // Find user by identifier
    const user = await db.user.findUnique({
      where: { identifier }
    });

    if (!user) {
      return NextResponse.json({ 
        error: 'البريد/الهاتف أو كلمة المرور غير صحيح' 
      }, { status: 401 });
    }

    // Verify password
    const hashedPassword = hashPassword(password);
    if (user.password !== hashedPassword) {
      return NextResponse.json({ 
        error: 'البريد/الهاتف أو كلمة المرور غير صحيح' 
      }, { status: 401 });
    }

    // Create new session token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      }
    });

    // Log successful login
    await db.securityLog.create({
      data: {
        action: 'login_success',
        identifier: user.identifier,
        details: 'Login successful'
      }
    });

    return NextResponse.json({ 
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      user: {
        id: user.id,
        identifier: user.identifier,
        name: user.name,
      },
      token
    });
  } catch (error) {
    console.error('Error logging in:', error);
    return NextResponse.json({ error: 'فشل في تسجيل الدخول' }, { status: 500 });
  }
}
