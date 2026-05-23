import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

/**
 * إعادة تعيين كلمة المرور باستخدام OTP
 * POST /api/auth/reset-password
 * Body: { email: string, otp: string, newPassword: string }
 * 
 * أو بدون OTP (إذا تم التحقق مسبقاً):
 * Body: { email: string, newPassword: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp, newPassword } = body;

    if (!email || !newPassword) {
      return NextResponse.json({ error: 'البريد الإلكتروني وكلمة المرور الجديدة مطلوبان' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // البحث عن المستخدم
    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { identifier: normalizedEmail }
        ]
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    // إذا تم إرسال OTP، تحقق منه
    if (otp) {
      if (user.otp !== otp) {
        return NextResponse.json({ error: 'رمز الاستعادة غير صحيح ❌' }, { status: 400 });
      }

      if (user.otpExpires && new Date() > user.otpExpires) {
        return NextResponse.json({ error: 'انتهت صلاحية الرمز. يرجى طلب رمز جديد ⏰' }, { status: 400 });
      }
    } else {
      // بدون OTP - تحقق من وجود رمز reset صالح
      if (!user.passwordResetToken) {
        return NextResponse.json({ error: 'لا يوجد طلب استعادة كلمة مرور نشط. يرجى طلب رمز أولاً.' }, { status: 400 });
      }

      if (user.passwordResetExpires && new Date() > user.passwordResetExpires) {
        return NextResponse.json({ error: 'انتهت صلاحية طلب الاستعادة. يرجى طلب رمز جديد ⏰' }, { status: 400 });
      }
    }

    // تحديث كلمة المرور
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        // مسح رموز الاستعادة
        passwordResetToken: null,
        passwordResetExpires: null,
        otp: null,
        otpExpires: null,
      },
    });

    // تسجيل العملية
    try {
      await db.operationLog.create({
        data: {
          action: 'PASSWORD_RESET_SUCCESS',
          entityType: 'User',
          entityId: user.id,
          details: JSON.stringify({ email: user.email }),
          userId: user.id,
        },
      });
    } catch {}

    return NextResponse.json({
      message: 'تم تغيير كلمة المرور بنجاح! ✅',
    });

  } catch (error) {
    console.error('❌ Error resetting password:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تغيير كلمة المرور' }, { status: 500 });
  }
}
