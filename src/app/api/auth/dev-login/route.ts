import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";
const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com';
const DEVELOPER_PASSWORD = process.env.DEVELOPER_PASSWORD || 'admin123';

const MAX_DEV_ATTEMPTS = 5;
const DEV_LOCKOUT_MINUTES = 60;

async function checkRateLimit(ip: string): Promise<{ blocked: boolean; message?: string }> {
  try {
    const record = await db.operationLog.findFirst({
      where: {
        action: 'dev-login-failed',
        ipAddress: ip,
        createdAt: { gte: new Date(Date.now() - DEV_LOCKOUT_MINUTES * 60 * 1000) }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (record && record.createdAt) {
      const failedCount = await db.operationLog.count({
        where: {
          action: 'dev-login-failed',
          ipAddress: ip,
          createdAt: { gte: record.createdAt }
        }
      });

      if (failedCount >= MAX_DEV_ATTEMPTS) {
        const lockedAt = new Date(record.createdAt.getTime() + DEV_LOCKOUT_MINUTES * 60 * 1000);
        const remaining = Math.ceil((lockedAt.getTime() - Date.now()) / 60000);
        return { blocked: true, message: `محاولات كثيرة. حاول بعد ${remaining} دقيقة` };
      }
    }
  } catch {
    // لو قاعدة البيانات مشتغلتش، نكمّل بدون rate limit
  }
  return { blocked: false };
}

async function recordFailed(ip: string): Promise<void> {
  try {
    await db.operationLog.create({
      data: {
        action: 'dev-login-failed',
        entityType: 'auth',
        ipAddress: ip,
      }
    });
  } catch {
    // silent
  }
}

async function clearFailed(ip: string): Promise<void> {
  try {
    await db.operationLog.deleteMany({
      where: {
        action: 'dev-login-failed',
        ipAddress: ip,
      }
    });
  } catch {
    // silent
  }
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 'unknown';
    
    const rateCheck = await checkRateLimit(ip);
    if (rateCheck.blocked) {
      return NextResponse.json({ error: rateCheck.message }, { status: 429 });
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'البريد وكلمة المرور مطلوبان' }, { status: 400 });
    }

    if (password.length < 6) {
      await recordFailed(ip);
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    const devEmail = DEVELOPER_EMAIL.toLowerCase();

    if (email.toLowerCase() !== devEmail) {
      await recordFailed(ip);
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    let user: any = null;
    try {
      user = await db.user.findUnique({
        where: { identifier: devEmail }
      });
    } catch (dbError: any) {
      console.error('DB Error in dev-login:', dbError?.message);
      return NextResponse.json({ error: 'خطأ في قاعدة البيانات' }, { status: 500 });
    }

    if (user) {
      const isDbPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isDbPasswordValid) {
        await recordFailed(ip);
        return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 });
      }

      if (user.role !== 'DEVELOPER') {
        user = await db.user.update({
          where: { id: user.id },
          data: { role: 'DEVELOPER', isApproved: true, emailVerified: true }
        });
      }
    } else {
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
      } catch {
        try {
          user = await db.user.findFirst({
            where: { OR: [{ identifier: devEmail }, { email: devEmail }] }
          });
          if (user) {
            const hashedPw = await bcrypt.hash(DEVELOPER_PASSWORD, 10);
            user = await db.user.update({
              where: { id: user.id },
              data: { identifier: devEmail, email: devEmail, role: 'DEVELOPER', isApproved: true, emailVerified: true, password: hashedPw }
            });
          }
        } catch {
          return NextResponse.json({ error: 'خطأ في قاعدة البيانات' }, { status: 500 });
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'حدث خطأ غير متوقع' }, { status: 500 });
    }

    await clearFailed(ip);

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

    return response;

  } catch (error: any) {
    console.error('Dev login error:', error);
    return NextResponse.json({ error: 'حدث خطأ في الدخول' }, { status: 500 });
  }
}
