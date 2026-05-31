import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";
const DEVELOPER_EMAIL = (process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com').toLowerCase();
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
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') || 'unknown';

    if (isDevRateLimited(ip)) {
      return NextResponse.json({ error: 'محاولات كثيرة. حاول بعد 30 دقيقة' }, { status: 429 });
    }

    const body = await request.json();
    const { email, password } = body;

    // ╔══════════════════════════════════════════════════════════╗
    // ║  الأمان: البريد وكلمة السر مطلوبين - بدون استثناءات     ║
    // ╚══════════════════════════════════════════════════════════╝
    if (!email || !password) {
      return NextResponse.json({ error: 'البريد وكلمة المرور مطلوبان' }, { status: 400 });
    }

    if (password.length < 4) {
      recordDevFailedAttempt(ip);
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    // ╔══════════════════════════════════════════════════════════╗
    // ║  التحقق من البريد - لازم يطابق DEVELOPER_EMAIL بالظبط    ║
    // ╚══════════════════════════════════════════════════════════╝
    if (email.toLowerCase().trim() !== DEVELOPER_EMAIL) {
      recordDevFailedAttempt(ip);
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    // ╔══════════════════════════════════════════════════════════╗
    // ║  التحقق من كلمة السر - لازم تطابق DEVELOPER_PASSWORD    ║
    // ║  أو كلمة السر المخزنة في الداتابيز                        ║
    // ╚══════════════════════════════════════════════════════════╝
    const isEnvPassword = password === DEVELOPER_PASSWORD;

    let user: any = null;
    try {
      user = await db.user.findUnique({
        where: { identifier: DEVELOPER_EMAIL }
      });
    } catch (dbError: any) {
      console.error('DB Error in dev-login:', dbError?.message);
    }

    if (user) {
      let isDbPasswordValid = false;
      try {
        isDbPasswordValid = await bcrypt.compare(password, user.password);
      } catch (bcryptErr) {
        console.error('Bcrypt error:', bcryptErr);
      }

      // لو كلمة السر غلط في كلتا الطريقتين = رفض
      if (!isEnvPassword && !isDbPasswordValid) {
        recordDevFailedAttempt(ip);
        return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 });
      }

      // ╔══════════════════════════════════════════════════════╗
      // ║  حساب المطور لا يمكن حظره أبداً                       ║
      // ║  إلغاء أي حظر + تأكد من الحالة الصحيحة                ║
      // ╚══════════════════════════════════════════════════════╝
      const updates: any = {
        role: 'DEVELOPER',
        isApproved: true,
        isBlocked: false,
        blockedAt: null,
        blockReason: null,
        emailVerified: true,
      };

      // مزامنة كلمة السر في الداتابيز لو اختلفت
      if (isEnvPassword && !isDbPasswordValid) {
        updates.password = await bcrypt.hash(DEVELOPER_PASSWORD, 10);
      }

      user = await db.user.update({
        where: { id: user.id },
        data: updates,
      });

    } else {
      // ╔══════════════════════════════════════════════════════╗
      // ║  إنشاء المطور تلقائياً لو مش موجود                      ║
      // ╚══════════════════════════════════════════════════════╝
      const hashedPassword = await bcrypt.hash(DEVELOPER_PASSWORD, 10);
      try {
        user = await db.user.create({
          data: {
            email: DEVELOPER_EMAIL,
            identifier: DEVELOPER_EMAIL,
            name: 'المطور - أحمد',
            phone: '+201234567890',
            password: hashedPassword,
            role: 'DEVELOPER',
            isApproved: true,
            isBlocked: false,
            emailVerified: true,
          }
        });
      } catch (createError: any) {
        // محاولة ثانية لو فيه conflict
        try {
          user = await db.user.findFirst({
            where: {
              OR: [
                { identifier: DEVELOPER_EMAIL },
                { email: DEVELOPER_EMAIL }
              ]
            }
          });
          if (user) {
            const hashedPw = await bcrypt.hash(DEVELOPER_PASSWORD, 10);
            user = await db.user.update({
              where: { id: user.id },
              data: {
                identifier: DEVELOPER_EMAIL,
                email: DEVELOPER_EMAIL,
                role: 'DEVELOPER',
                isApproved: true,
                isBlocked: false,
                blockedAt: null,
                blockReason: null,
                emailVerified: true,
                password: hashedPw,
              }
            });
          }
        } catch (retryError: any) {
          console.error('Retry error:', retryError?.message);
          return NextResponse.json({ error: 'خطأ في قاعدة البيانات' }, { status: 500 });
        }

        if (!user) {
          return NextResponse.json({ error: 'لم يتم إنشاء حساب المطور' }, { status: 500 });
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
