import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/auth';


// ⚠️ كلمة السر والإيميل من Environment Variables بس - مفيش hardcoded
const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL;
const DEVELOPER_PASSWORD = process.env.DEVELOPER_PASSWORD;

// Rate limiting
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

    if (!email || !password) {
      return NextResponse.json({ error: 'البريد وكلمة المرور مطلوبان' }, { status: 400 });
    }

    // ⚠️ التحقق من أن DEVELOPER_EMAIL و DEVELOPER_PASSWORD موجودين في ENV
    if (!DEVELOPER_EMAIL || !DEVELOPER_PASSWORD) {
      console.error('DEV LOGIN: DEVELOPER_EMAIL or DEVELOPER_PASSWORD not set in environment');
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    // ⚠️ التحقق من الإيميل المحدد فقط
    if (email !== DEVELOPER_EMAIL) {
      recordDevFailedAttempt(ip);
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    // البحث عن المطور في قاعدة البيانات
    let user = await db.user.findUnique({
      where: { identifier: DEVELOPER_EMAIL }
    });

    if (user) {
      // التحقق من كلمة السر (من الداتابيز أو من ENV)
      const isEnvPasswordValid = password === DEVELOPER_PASSWORD;
      const isDbPasswordValid = await bcrypt.compare(password, user.password);

      if (!isEnvPasswordValid && !isDbPasswordValid) {
        recordDevFailedAttempt(ip);
        return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 });
      }

      // تحديث كلمة السر في الداتابيز لو تغيرت في ENV
      if (isEnvPasswordValid && !isDbPasswordValid) {
        const hashedPassword = await bcrypt.hash(DEVELOPER_PASSWORD, 10);
        await db.user.update({
          where: { id: user.id },
          data: { password: hashedPassword, role: 'DEVELOPER', isApproved: true, emailVerified: true }
        });
      }
    } else {
      // إنشاء المطور تلقائياً
      const hashedPassword = await bcrypt.hash(DEVELOPER_PASSWORD, 10);
      user = await db.user.create({
        data: {
          email: DEVELOPER_EMAIL,
          identifier: DEVELOPER_EMAIL,
          name: 'المطور - أحمد',
          phone: '+201234567890',
          password: hashedPassword,
          role: 'DEVELOPER',
          isApproved: true,
          emailVerified: true,
        }
      });
    }

    const token = jwt.sign(
      { userId: user.id, identifier: user.identifier, role: 'DEVELOPER' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, identifier: user.identifier, name: user.name, role: user.role },
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    // مسح محاولات الدخول الفاشلة
    devLoginAttempts.delete(ip);

    return response;

  } catch (error) {
    console.error('Dev login error:', error);
    return NextResponse.json({ error: 'حدث خطأ في الدخول' }, { status: 500 });
  }
}
