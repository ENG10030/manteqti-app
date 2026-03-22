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
    const { identifier, password } = body;

    // التحقق من وجود البيانات
    if (!identifier || !password) {
      return NextResponse.json({ 
        error: 'البريد/الهاتف وكلمة المرور مطلوبان',
        details: { identifier: !identifier, password: !password }
      }, { status: 400 });
    }

    // البحث عن المستخدم
    let user;
    try {
      user = await db.user.findUnique({
        where: { identifier: identifier.toLowerCase().trim() }
      });
    } catch (dbError) {
      console.error('Database error finding user:', dbError);
      return NextResponse.json({ 
        error: 'خطأ في الاتصال بقاعدة البيانات. يرجى المحاولة مرة أخرى.',
        details: process.env.NODE_ENV === 'development' ? String(dbError) : undefined
      }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ 
        error: 'لم يتم العثور على حساب بهذا البريد/الهاتف. تأكد من البيانات أو قم بإنشاء حساب جديد.',
        details: { identifier }
      }, { status: 401 });
    }

    // التحقق من كلمة المرور
    const hashedPassword = hashPassword(password);
    if (user.password !== hashedPassword) {
      return NextResponse.json({ 
        error: 'كلمة المرور غير صحيحة. تأكد من كتابتها بشكل صحيح.',
        details: { hint: 'إذا نسيت كلمة المرور، تواصل مع الدعم' }
      }, { status: 401 });
    }

    // إنشاء جلسة جديدة
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

    // تسجيل نجاح الدخول
    try {
      await db.securityLog.create({
        data: {
          action: 'login_success',
          identifier: user.identifier,
          details: 'Login successful'
        }
      });
    } catch {
      // تجاهل أخطاء التسجيل
    }

    // إنشاء الاستجابة
    const response = NextResponse.json({ 
      success: true,
      message: 'تم تسجيل الدخول بنجاح! مرحباً ' + user.name,
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
    console.error('Unexpected error in login:', error);
    return NextResponse.json({ 
      error: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
}
