import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { sendPasswordChangedEmail } from '@/lib/email';

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

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }, { status: 400 });
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

    // Verify OTP
    if (user.passwordResetToken !== otp) {
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
