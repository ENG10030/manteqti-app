import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { sendPasswordChangedEmail } from '@/lib/email';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'البريد الإلكتروني مطلوب' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { identifier: normalizedEmail }
        ]
      },
      select: { id: true, passwordResetExpires: true }
    });

    if (!user) {
      // Don't reveal if user exists
      return NextResponse.json({ success: true, canReset: false });
    }

    const canReset = user.passwordResetExpires && user.passwordResetExpires > new Date();

    return NextResponse.json({ success: true, canReset: !!canReset });

  } catch (error) {
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, newPassword, confirmPassword } = body;

    if (!email || !code || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'كلمتا المرور غير متطابقتين' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' }, { status: 400 });
    }

    if (newPassword.length > 128) {
      return NextResponse.json({ error: 'كلمة المرور طويلة جداً' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { identifier: normalizedEmail }
        ]
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'البريد الإلكتروني غير مسجل' }, { status: 400 });
    }

    if (!user.passwordResetToken || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return NextResponse.json({ error: 'انتهت صلاحية الرمز. يرجى طلب رمز جديد' }, { status: 400 });
    }

    // Use bcrypt.compare since token is now hashed
    const isTokenValid = await bcrypt.compare(code, user.passwordResetToken);

    if (!isTokenValid) {
      return NextResponse.json({ error: 'رمز الاستعادة غير صحيح' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await db.user.update({
      where: { id: user.id },
      data: { 
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null
      }
    });

    // 📧 Send password changed confirmation email (fire-and-forget)
    const userEmail = user.email || normalizedEmail;
    sendPasswordChangedEmail({ to: userEmail, name: user.name }).catch((err) => {
      console.error('Failed to send password changed email:', err?.message);
    });

    return NextResponse.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });

  } catch (error) {
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
