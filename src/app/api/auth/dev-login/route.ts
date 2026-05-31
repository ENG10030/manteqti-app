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
const DEV_LOCKOUT_TIME = 30 * 60 * 1000;

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
    // ║  التحقق من كلمة السر من Env أولاً (بدون داتابيز)          ║
    // ║  لو كلمة السر غلط = رفض فوراً بدون ما نلمس الداتابيز     ║
    // ╚══════════════════════════════════════════════════════════╝
    const isEnvPassword = password === DEVELOPER_PASSWORD;

    if (!isEnvPassword) {
      // كلمة السر مش مطابقة لـ Env - نجرب الداتابيز
      let user: any = null;
      try {
        user = await db.user.findUnique({
          where: { identifier: DEVELOPER_EMAIL }
        });
      } catch (dbError: any) {
        console.error('DB find error:', dbError?.message);
        // الداتابيز مش شغالة وكلمة السر غلط = رفض
        recordDevFailedAttempt(ip);
        return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 });
      }

      if (user) {
        try {
          const isDbPasswordValid = await bcrypt.compare(password, user.password);
          if (!isDbPasswordValid) {
            recordDevFailedAttempt(ip);
            return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 });
          }
        } catch (bcryptErr) {
          console.error('Bcrypt error:', bcryptErr);
          recordDevFailedAttempt(ip);
          return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 });
        }
      } else {
        // كلمة السر مش مطابقة ولا فيه مستخدم في الداتابيز
        recordDevFailedAttempt(ip);
        return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 });
      }
    }

    // ╔══════════════════════════════════════════════════════════╗
    // ║  كلمة السر صحيحة - الآن نحاول نلاقي/ننشئ المستخدم        ║
    // ╚══════════════════════════════════════════════════════════╝
    let user: any = null;
    let dbOk = true;

    try {
      user = await db.user.findUnique({
        where: { identifier: DEVELOPER_EMAIL }
      });
    } catch (dbError: any) {
      console.error('DB Error (findUser):', dbError?.message);
      dbOk = false;
    }

    if (user) {
      // ╔══════════════════════════════════════════════════════╗
      // ║  المستخدم موجود - إلغاء أي حظر + مزامنة كلمة السر    ║
      // ╚══════════════════════════════════════════════════════╝
      try {
        const updates: any = {
          role: 'DEVELOPER',
          isApproved: true,
          isBlocked: false,
          blockedAt: null,
          blockReason: null,
          emailVerified: true,
        };

        // مزامنة كلمة السر لو اختلفت
        let isDbPwValid = false;
        try { isDbPwValid = await bcrypt.compare(DEVELOPER_PASSWORD, user.password); } catch {}
        if (!isDbPwValid) {
          updates.password = await bcrypt.hash(DEVELOPER_PASSWORD, 10);
        }

        user = await db.user.update({
          where: { id: user.id },
          data: updates,
        });
      } catch (updateError: any) {
        console.error('DB Error (updateUser):', updateError?.message);
        // لو التحديث فشل، نكمل بالبيانات القديمة
      }

    } else if (dbOk) {
      // ╔══════════════════════════════════════════════════════╗
      // ║  الداتابيز شغالة بس المستخدم مش موجود = إنشئه          ║
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
        console.error('DB Error (createUser):', createError?.message);
        // محاولة ثانية
        try {
          user = await db.user.findFirst({
            where: { OR: [{ identifier: DEVELOPER_EMAIL }, { email: DEVELOPER_EMAIL }] }
          });
          if (user) {
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
                password: hashedPassword,
              }
            });
          }
        } catch (retryError: any) {
          console.error('DB Error (retry):', retryError?.message);
        }
      }
    }

    // ╔══════════════════════════════════════════════════════════╗
    // ║  لو الداتابيز كلها مش شغالة - سجل دخول بدون داتابيز     ║
    // ║  باستخدام token مؤقت (مع إشعار إن الداتابيز مش متاحة)    ║
    // ╚══════════════════════════════════════════════════════════╝
    if (!user) {
      console.log('Dev login: DB unavailable, using offline mode');
      
      const token = jwt.sign(
        { 
          userId: 'developer-offline', 
          identifier: DEVELOPER_EMAIL, 
          role: 'DEVELOPER' 
        },
        JWT_SECRET,
        { expiresIn: '1d' }
      );

      const response = NextResponse.json({
        success: true,
        message: 'تم تسجيل دخول المطور (وضع مؤقت - الداتابيز غير متاحة)',
        user: { 
          id: 'developer-offline', 
          identifier: DEVELOPER_EMAIL, 
          name: 'المطور - أحمد', 
          role: 'DEVELOPER' 
        },
        warning: 'database_unavailable',
      });

      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24,
        path: '/',
      });

      return response;
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
