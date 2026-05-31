import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendPasswordChangedEmail } from '@/lib/email';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = "force-dynamic";

// 🔒 Timing-safe string comparison
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf-8'), Buffer.from(b, 'utf-8'));
  } catch {
    return false;
  }
}

// POST - Reset password using OTP code
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp, newPassword, confirmPassword } = body;

    if (!email || !otp || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'كلمتا المرور غير متطابقتين' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حروف وأرقام' }, { status: 400 });
    }

    // 🔒 Check password strength
    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    if (!hasLetter || !hasNumber) {
      return NextResponse.json({ error: 'كلمة المرور يجب أن تحتوي على حروف وأرقام' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit: 5 attempts per 15 minutes per email
    const allowed = await checkRateLimit('reset-password', 'email', normalizedEmail, 5, 15 * 60);
    if (!allowed) {
      return NextResponse.json({ error: 'طلبات كثيرة. حاول بعد 15 دقيقة' }, { status: 429 });
    }

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

    // Verify OTP — 🔒 timing-safe comparison
    if (!safeCompare(user.passwordResetToken || '', otp)) {
      return NextResponse.json({ error: 'رمز الاستعادة غير صحيح' }, { status: 400 });
    }

    // Check expiry
    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return NextResponse.json({ error: 'انتهت صلاحية الرمز. يرجى طلب رمز جديد' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.user.update({
      where: { id: user.id },
      data: { 
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null
      }
    });

    // Send password change notification email (fire-and-forget)
    const userEmail = user.email || user.identifier;
    if (userEmail) {
      sendPasswordChangedEmail({ to: userEmail, name: user.name }).catch(err => {
        console.error('Failed to send password reset notification:', err);
      });
    }

    return NextResponse.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });

  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
