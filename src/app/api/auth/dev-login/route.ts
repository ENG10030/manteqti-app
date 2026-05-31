import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";
const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com';
const DEVELOPER_PASSWORD = process.env.DEVELOPER_PASSWORD || 'admin123';

// Rate limiting بالذاكرة
const devLoginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_DEV_ATTEMPTS = 10;
const DEV_LOCKOUT_TIME = 30 * 60 * 1000; // 30 دقيقة

function isDevRateLimited(ip: string): boolean {
  const record = devLoginAttempts.get(ip);
  if (!record) return false;
  if (Date.now() - record.lastAttempt > DEV_LOCKOUT_TIME) {
    devLoginAttempts.delete(ip);
    return false;
  }
  return record.count >= MAX_DEV_ATTEMPTS;
}

function recordDevFailedAttempt(ip: string): void {
  const record = devLoginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  record.count++;
  record.lastAttempt = Date.now();
  devLoginAttempts.set(ip, record);
}

export async function POST(request: Request) {
  try {
    // Rate limiting بالـ IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') || 'unknown';

    if (isDevRateLimited(ip)) {
      return NextResponse.json({ error: 'محاولات كثيرة. حاول بعد 30 دقيقة' }, { status: 429 });
    }

    const body = await request.json();
    const { email, password } = body;

    // === الأمان: مطلوب البريد وكلمة السر معاً ===
    if (!email || !password) {
      return NextResponse.json({ error: 'البريد وكلمة المرور مطلوبان' }, { status: 400 });
    }

    if (password.length < 4) {
      recordDevFailedAttempt(ip);
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    const devEmail = DEVELOPER_EMAIL.toLowerCase();

    // التحقق من البريد الإلكتروني
    if (email.toLowerCase() !== devEmail) {
      recordDevFailedAttempt(ip);
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    // البحث عن المطور في قاعدة البيانات
    let user: any = null;
    try {
      user = await db.user.findUnique({
        where: { identifier: devEmail }
      });
    } catch (dbError: any) {
      console.error('DB Error in dev-login:', dbError?.message);
    }

    if (user) {
      // المستخدم موجود - لازم نتحقق من كلمة السر
      const isEnvPassword = password === DEVELOPER_PASSWORD;
      const isDbPasswordValid = await bcrypt.compare(password, user.password);

      if (!isEnvPassword && !isDbPasswordValid) {
        recordDevFailedAttempt(ip);
        return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 });
      }

      // تحديث كلمة السر في الداتابيز لو كانت مختلفة
      if (isEnvPassword && !isDbPasswordValid) {
        const hashedPassword = await bcrypt.hash(DEVELOPER_PASSWORD, 10);
        user = await db.user.update({
          where: { id: user.id },
          data: {
            password: hashedPassword,
            role: 'DEVELOPER',
            isApproved: true,
            emailVerified: true
          }
        });
      }

      // تحديث الدور لو مش DEVELOPER
      if (user.role !== 'DEVELOPER') {
        user = await db.user.update({
          where: { id: user.id },
          data: { role: 'DEVELOPER', isApproved: true, emailVerified: true }
        });
      }
    } else {
      // إنشاء المطور تلقائياً
      const hashedPassword = await bcrypt.hash(DEVELOPER_PASSWORD, 10);
      try {
        user = await db.user.create({
          data: {
            email: devEmail,
            identifier: devEmail,
            name: 'المطور - أحمد',
            phone: '+201234567890',
            password: hashedPassword,
            role: 'DEVELOPER',
            isApproved: true,
            emailVerified: true,
          }
        });
      } catch (createError: any) {
        console.error('Create user error:', createError?.message);
        try {
          user = await db.user.findFirst({
            where: {
              OR: [
                { identifier: devEmail },
                { email: devEmail }
              ]
            }
          });
          if (user) {
            const hashedPw = await bcrypt.hash(DEVELOPER_PASSWORD, 10);
            user = await db.user.update({
              where: { id: user.id },
              data: {
                identifier: devEmail,
                email: devEmail,
                role: 'DEVELOPER',
                isApproved: true,
                emailVerified: true,
                password: hashedPw,
              }
            });
          }
        } catch (retryError: any) {
          console.error('Retry error:', retryError?.message);
          return NextResponse.json({
            error: 'خطأ في قاعدة البيانات',
            details: process.env.NODE_ENV !== 'production' ? retryError?.message : undefined
          }, { status: 500 });
        }

        if (!user) {
          return NextResponse.json({
            error: 'لم يتم إنشاء حساب المطور',
          }, { status: 500 });
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'حدث خطأ غير متوقع' }, { status: 500 });
    }

    // مسح محاولات الدخول الفاشلة
    devLoginAttempts.delete(ip);

    // إنشاء JWT token
    const token = jwt.sign(
      { userId: user.id, identifier: user.identifier, role: 'DEVELOPER' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const response = NextResponse.json({
      success: true,
      message: 'تم تسجيل دخول المطور بنجاح',
      user: { id: user.id, identifier: user.identifier, name: user.name, role: user.role },
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;

  } catch (error: any) {
    console.error('Dev login error:', error);
    return NextResponse.json({ error: 'حدث خطأ في الدخول' }, { status: 500 });
  }
}
