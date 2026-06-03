import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/auth';
import { timingSafeEqual } from 'crypto';

// Rate limiting per IP (5 attempts per 15 minutes)
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return false;
  }
  entry.count += 1;
  return true;
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a constant-time comparison to avoid timing leaks on length difference
    timingSafeEqual(Buffer.from(a), Buffer.from(b));
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json({ error: 'طلبات كثيرة. يرجى المحاولة بعد 15 دقيقة' }, { status: 429 });
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'البريد وكلمة المرور مطلوبان' }, { status: 400 });
    }

    const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com';
    const DEVELOPER_PASSWORD = process.env.DEVELOPER_PASSWORD;

    if (!DEVELOPER_PASSWORD) {
      return NextResponse.json({ error: 'بيانات المطور غير مهيأة' }, { status: 500 });
    }

    if (email === DEVELOPER_EMAIL && safeCompare(password, DEVELOPER_PASSWORD)) {
      let user: any = null;
      try {
        user = await db.user.findUnique({
          where: { identifier: DEVELOPER_EMAIL }
        });
      } catch {
        return NextResponse.json({ error: 'خطأ في قاعدة البيانات' }, { status: 500 });
      }

      if (!user) {
        try {
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
        } catch {
          return NextResponse.json({ error: 'خطأ في إنشاء الحساب' }, { status: 500 });
        }
      }

      const token = jwt.sign(
        { userId: user.id, identifier: user.identifier, role: user.role },
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
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });

      return response;
    }

    // Fallback: check DB user
    const user = await db.user.findUnique({ where: { identifier: email } });

    if (!user || user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    const token = jwt.sign(
      { userId: user.id, identifier: user.identifier, role: user.role },
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
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;

  } catch (error) {
    return NextResponse.json({ error: 'حدث خطأ في السيرفر' }, { status: 500 });
  }
}
