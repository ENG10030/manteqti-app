import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { JWT_SECRET, createToken, createAuthResponse } from '@/lib/auth';
import { safeCompare } from '@/lib/security';

// SECURITY: Dev login only available in non-production environments
export async function POST(request: NextRequest) {
  // CRITICAL: Block dev-login in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'هذا المسار غير متاح في بيئة الإنتاج' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'البريد وكلمة المرور مطلوبان' }, { status: 400 });
    }

    const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL;
    const DEVELOPER_PASSWORD = process.env.DEVELOPER_PASSWORD;

    if (!DEVELOPER_EMAIL || !DEVELOPER_PASSWORD) {
      return NextResponse.json({ error: 'بيانات المطور غير مهيأة. تأكد من تعيين DEVELOPER_EMAIL و DEVELOPER_PASSWORD' }, { status: 500 });
    }

    // Use timing-safe comparison to prevent timing attacks
    if (!safeCompare(email.toLowerCase().trim(), DEVELOPER_EMAIL.toLowerCase().trim())) {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    if (!safeCompare(password, DEVELOPER_PASSWORD)) {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    let user = await db.user.findUnique({
      where: { identifier: DEVELOPER_EMAIL }
    });

    if (!user) {
      const hashedPassword = await bcrypt.hash(DEVELOPER_PASSWORD, 12);
      user = await db.user.create({
        data: {
          email: DEVELOPER_EMAIL,
          identifier: DEVELOPER_EMAIL,
          name: 'المطور',
          phone: '',
          password: hashedPassword,
          role: 'DEVELOPER',
          isApproved: true,
          emailVerified: true,
        }
      });
    }

    const token = createToken(
      { userId: user.id, identifier: user.identifier, role: user.role }
    );

    return createAuthResponse({
      success: true,
      user: { id: user.id, identifier: user.identifier, name: user.name, role: user.role },
    }, token);

  } catch (error) {
    console.error('Dev login error:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
