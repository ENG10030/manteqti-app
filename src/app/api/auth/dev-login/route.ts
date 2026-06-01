import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// 🔒 SECURITY: لا يوجد fallback - يجب تعيينها في البيئة
const JWT_SECRET = process.env.JWT_SECRET;
const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL;
const DEVELOPER_PASSWORD = process.env.DEVELOPER_PASSWORD;

// 🔒 SECURITY: حظر هذا الـ endpoint في Production
if (process.env.NODE_ENV === 'production') {
  console.log('🔒 dev-login is DISABLED in production');
}

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
      data: { action: 'dev-login-failed', entityType: 'auth', ipAddress: ip }
    });
  } catch { /* silent */ }
}

async function clearFailed(ip: string): Promise<void> {
  try {
    await db.operationLog.deleteMany({
      where: { action: 'dev-login-failed', ipAddress: ip }
    });
  } catch { /* silent */ }
}

export async function POST(request: Request) {
  try {
    // 🔒 SECURITY: حظر في Production
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'هذا الـ endpoint غير متاح في بيئة الإنتاج' }, { status: 404 });
    }

    if (!JWT_SECRET || !DEVELOPER_EMAIL || !DEVELOPER_PASSWORD) {
      console.error('⚠️ CRITICAL: بيئة المطور غير معرفة');
      return NextResponse.json({ error: 'خطأ في إعدادات الخادم' }, { status: 500 });
    }

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

    // 🔒 timing-safe comparison للبريد الإلكتروني
    try {
      const emailMatch = crypto.timingSafeEqual(
        Buffer.from(email.toLowerCase().trim()),
        Buffer.from(DEVELOPER_EMAIL.toLowerCase().trim())
      );
      if (!emailMatch) {
        await recordFailed(ip);
        return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
      }
    } catch {
      await recordFailed(ip);
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    let user: any = null;
    try {
      user = await db.user.findUnique({
        where: { identifier: DEVELOPER_EMAIL.toLowerCase() }
      });
    } catch (dbError: any) {
      console.error('DB Error in dev-login:', dbError?.code);
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
      return NextResponse.json({
        error: 'حساب المطور غير موجود',
        hint: 'قم بتشغيل init-db أولاً لتهيئة قاعدة البيانات'
      }, { status: 404 });
    }

    if (!user) {
      return NextResponse.json({ error: 'حدث خطأ غير متوقع' }, { status: 500 });
    }

    await clearFailed(ip);

    const token = jwt.sign(
      { userId: user.id, identifier: user.identifier },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, identifier: user.identifier, name: user.name, role: user.role },
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('Dev login error:', error);
    return NextResponse.json({ error: 'حدث خطأ في الدخول' }, { status: 500 });
  }
}
