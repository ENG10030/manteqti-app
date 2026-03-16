import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomBytes, createHash } from 'crypto';

// Hash password with SHA-256
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const { identifier, name, password } = await request.json();

    if (!identifier || !password || !name) {
      return NextResponse.json({ 
        error: 'جميع الحقول مطلوبة: البريد/الهاتف، الاسم، كلمة المرور' 
      }, { status: 400 });
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json({ 
        error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' 
      }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { identifier }
    });

    if (existingUser) {
      return NextResponse.json({ 
        error: 'هذا البريد/الهاتف مسجل بالفعل' 
      }, { status: 400 });
    }

    // Create new user with hashed password
    const hashedPassword = hashPassword(password);
    const user = await db.user.create({
      data: {
        identifier,
        name,
        password: hashedPassword,
        email: identifier.includes('@') ? identifier : null,
        phone: identifier.includes('@') ? null : identifier,
      }
    });

    // Create session token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      }
    });

    return NextResponse.json({ 
      success: true,
      message: 'تم التسجيل بنجاح',
      user: {
        id: user.id,
        identifier: user.identifier,
        name: user.name,
      },
      token
    });
  } catch (error) {
    console.error('Error registering user:', error);
    return NextResponse.json({ error: 'فشل في التسجيل' }, { status: 500 });
  }
}
