import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";
const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com';
const DEVELOPER_PASSWORD = process.env.DEVELOPER_PASSWORD || 'admin123';

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

    // السماح بالدخول بأي من الإيميلات المطلوبة
    const validEmails = [DEVELOPER_EMAIL, 'ahmadmamdouh10030@gmail.com'].map(e => e.toLowerCase());
    if (!validEmails.includes(email.toLowerCase())) {
      recordDevFailedAttempt(ip);
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    const devEmail = DEVELOPER_EMAIL.toLowerCase();

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
      const isDefaultPassword = password === DEVELOPER_PASSWORD;
      const isEnvPassword = process.env.DEVELOPER_PASSWORD && password === process.env.DEVELOPER_PASSWORD;
      const isDbPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isDefaultPassword && !isEnvPassword && !isDbPasswordValid) {
        recordDevFailedAttempt(ip);
        return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 });
      }

      // تحديث كلمة السر والدور لو محتاج
      if ((isDefaultPassword || isEnvPassword) && !isDbPasswordValid) {
        const hashedPassword = await bcrypt.hash(password, 10);
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
        // لو الـ create فشل (مثلاً لأن الـ user موجود بالفعل بـ email مختلف)
        // نحاول نعمل find مرة تانية
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
            // تحديث البيانات
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
            details: process.env.NODE_ENV !== 'production' ? retryError?.message : 'تأكد من أن DATABASE_URL صحيح على Vercel ومضاف كـ All Environments'
          }, { status: 500 });
        }
        
        if (!user) {
          return NextResponse.json({ 
            error: 'لم يتم إنشاء حساب المطور',
            hint: 'تأكد من تشغيل init-db أولاً: /api/init-db?setupKey=manteqti-setup-2024'
          }, { status: 500 });
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

    // مسح محاولات الدخول الفاشلة
    devLoginAttempts.delete(ip);

    return response;

  } catch (error: any) {
    console.error('Dev login error:', error);
    return NextResponse.json({ 
      error: 'حدث خطأ في الدخول',
      details: process.env.NODE_ENV !== 'production' ? error?.message : undefined,
      hint: 'تأكد من أن DATABASE_URL و DIRECT_DATABASE_URL موجودين كـ All Environments على Vercel'
    }, { status: 500 });
  }
}
