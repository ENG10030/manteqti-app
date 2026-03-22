import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomBytes, createHash } from 'crypto';

// Hash password with SHA-256
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier, name, password } = body;

    // التحقق من وجود البيانات
    if (!identifier || !password || !name) {
      return NextResponse.json({ 
        error: 'جميع الحقول مطلوبة: البريد/الهاتف، الاسم، كلمة المرور',
        details: { identifier: !identifier, name: !name, password: !password }
      }, { status: 400 });
    }

    // التحقق من طول كلمة المرور
    if (password.length < 6) {
      return NextResponse.json({ 
        error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
        details: { passwordLength: password.length }
      }, { status: 400 });
    }

    // التحقق من طول الاسم
    if (name.length < 2) {
      return NextResponse.json({ 
        error: 'الاسم يجب أن يكون حرفين على الأقل',
        details: { nameLength: name.length }
      }, { status: 400 });
    }

    // التحقق من صحة البريد الإلكتروني
    if (identifier.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(identifier)) {
        return NextResponse.json({ 
          error: 'صيغة البريد الإلكتروني غير صحيحة',
          details: { identifier }
        }, { status: 400 });
      }
    }

    // التحقق من عدم وجود المستخدم
    let existingUser;
    try {
      existingUser = await db.user.findUnique({
        where: { identifier }
      });
    } catch (dbError) {
      console.error('Database error checking user:', dbError);
      return NextResponse.json({ 
        error: 'خطأ في الاتصال بقاعدة البيانات. يرجى المحاولة مرة أخرى.',
        details: process.env.NODE_ENV === 'development' ? String(dbError) : undefined
      }, { status: 500 });
    }

    if (existingUser) {
      return NextResponse.json({ 
        error: 'هذا البريد/الهاتف مسجل بالفعل. جرب تسجيل الدخول بدلاً من ذلك.',
        details: { identifier }
      }, { status: 400 });
    }

    // إنشاء المستخدم
    const hashedPassword = hashPassword(password);
    let user;
    try {
      user = await db.user.create({
        data: {
          identifier,
          name,
          password: hashedPassword,
          email: identifier.includes('@') ? identifier : null,
          phone: identifier.includes('@') ? null : identifier,
        }
      });
    } catch (createError) {
      console.error('Error creating user:', createError);
      return NextResponse.json({ 
        error: 'فشل في إنشاء الحساب. يرجى المحاولة مرة أخرى.',
        details: process.env.NODE_ENV === 'development' ? String(createError) : undefined
      }, { status: 500 });
    }

    // إنشاء جلسة
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 يوم

    try {
      await db.session.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        }
      });
    } catch (sessionError) {
      console.error('Error creating session:', sessionError);
      // نستمر حتى لو فشل إنشاء الجلسة
    }

    // إنشاء الاستجابة
    const response = NextResponse.json({ 
      success: true,
      message: 'تم التسجيل بنجاح! مرحباً ' + name,
      user: {
        id: user.id,
        identifier: user.identifier,
        name: user.name,
      },
      token
    });

    // تعيين cookie
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('Unexpected error in register:', error);
    return NextResponse.json({ 
      error: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
}
