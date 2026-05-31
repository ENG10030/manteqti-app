import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import bcrypt from "bcryptjs";
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/auth';
import { sendPasswordChangedEmail } from '@/lib/email';

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }

    let decoded: any;
    try {
      decoded = verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'جلسة غير صالحة' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' }, { status: 400 });
    }

    if (newPassword.length > 128) {
      return NextResponse.json({ error: 'كلمة المرور طويلة جداً' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'كلمة المرور الحالية غير صحيحة' }, { status: 401 });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    await db.user.update({
      where: { id: user.id },
      data: { password: hashedNewPassword }
    });

    // Send email notification about password change (fire-and-forget)
    const userEmail = user.email || user.identifier;
    if (userEmail) {
      sendPasswordChangedEmail({ to: userEmail, name: user.name }).catch(err => {
        console.error('Failed to send password change notification:', err);
      });
    }

    return NextResponse.json({
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json({ error: 'حدث خطأ في تغيير كلمة المرور' }, { status: 500 });
  }
}
