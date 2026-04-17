import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";
const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com';
const DEVELOPER_PASSWORD = process.env.DEVELOPER_PASSWORD || 'admin123';

// Rate limiting أقوى
const devLoginAttempts = new Map<string, { count: number; lastAttempt: number; lockedUntil: number }>();
const MAX_DEV_ATTEMPTS = 5;
const DEV_LOCKOUT_TIME = 60 * 60 * 1000; // ساعة كاملة

function checkDevRateLimit(ip: string): { blocked: boolean; message?: string } {
  const record = devLoginAttempts.get(ip);
  if (!record) return { blocked: false };
  
  if (record.lockedUntil && Date.now() < record.lockedUntil) {
    const remaining = Math.ceil((record.lockedUntil - Date.now()) / 60000);
    return { blocked: true, message: `محاولات كثيرة. حاول بعد ${remaining} دقيقة` };
  }
  
  if (record.lockedUntil && Date.now() >= record.lockedUntil) {
    devLoginAttempts.delete(ip);
    return { blocked: false };
  }
  
  return { blocked: false };
}

function recordDevFailed(ip: string): void {
  const record = devLoginAttempts.get(ip) || { count: 0, lastAttempt: 0, lockedUntil: 0 };
  record.count++;
  record.lastAttempt = Date.now();
  
  if (record.count >= MAX_DEV_ATTEMPTS) {
    record.lockedUntil = Date.now() + DEV_LOCKOUT_TIME;
  }
  
  devLoginAttempts.set(ip, record);
}

function clearDevAttempts(ip: string): void {
  devLoginAttempts.delete(ip);
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 'unknown';
    
    // Rate limiting
    const rateCheck = checkDevRateLimit(ip);
    if (rateCheck.blocked) {
      return NextResponse.json({ error: rateCheck.message }, { status: 429 });
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'البريد وكلمة المرور مطلوبان' }, { status: 400 });
    }

    if (!password || password.length < 6) {
      recordDevFailed(ip);
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    const devEmail = DEVELOPER_EMAIL.toLowerCase();

    if (email.toLowerCase() !== devEmail) {
      recordDevFailed(ip);
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
      return NextResponse.json({ 
        error: 'خطأ في قاعدة البيانات',
        hint: 'تأكد من اتصال قاعدة البيانات'
      }, { status: 500 });
    }

    if (user) {
      const isDbPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isDbPasswordValid) {
        recordDevFailed(ip);
        return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 });
      }

      // تحديث الدور لو محتاج
      if (user.role !== 'DEVELOPER') {
        user = await db.user.update({
          where: { id: user.id },
          data: { role: 'DEVELOPER', isApproved: true, emailVerified: true }
        });
      }
    } else {
      // إنشاء المطور تلقائياً فقط لو كلمة السر مطابقة للـ env
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
          return NextResponse.json({ error: 'خطأ في قاعدة البيانات' }, { status: 500 });
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'حدث خطأ غير متوقع' }, { status: 500 });
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

    clearDevAttempts(ip);
    return response;

  } catch (error: any) {
    console.error('Dev login error:', error);
    return NextResponse.json({ error: 'حدث خطأ في الدخول' }, { status: 500 });
  }
}
