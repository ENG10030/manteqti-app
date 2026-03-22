import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';

// Hash password with SHA-256
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

// التحقق من صلاحية الرمز
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'الرمز غير موجود' }, { status: 400 });
    }

    // البحث عن الرمز
    const resetRecord = await db.passwordReset.findUnique({
      where: { token }
    });

    if (!resetRecord) {
      return NextResponse.json({ error: 'الرمز غير صالح' }, { status: 400 });
    }

    // التحقق من انتهاء الصلاحية
    if (resetRecord.expiresAt < new Date()) {
      return NextResponse.json({ error: 'انتهت صلاحية الرمز' }, { status: 400 });
    }

    // التحقق من استخدام الرمز
    if (resetRecord.used) {
      return NextResponse.json({ error: 'تم استخدام هذا الرمز من قبل' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      email: resetRecord.email
    });

  } catch (error) {
    console.error('Error verifying reset token:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// إعادة تعيين كلمة المرور
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, newPassword, confirmPassword } = body;

    // التحقق من البيانات
    if (!token || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'كلمتا المرور غير متطابقتين' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }, { status: 400 });
    }

    // البحث عن الرمز
    const resetRecord = await db.passwordReset.findUnique({
      where: { token }
    });

    if (!resetRecord) {
      return NextResponse.json({ error: 'الرمز غير صالح' }, { status: 400 });
    }

    // التحقق من انتهاء الصلاحية
    if (resetRecord.expiresAt < new Date()) {
      return NextResponse.json({ error: 'انتهت صلاحية الرمز' }, { status: 400 });
    }

    // التحقق من استخدام الرمز
    if (resetRecord.used) {
      return NextResponse.json({ error: 'تم استخدام هذا الرمز من قبل' }, { status: 400 });
    }

    // البحث عن المستخدم
    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: resetRecord.email },
          { identifier: resetRecord.email }
        ]
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 400 });
    }

    // تحديث كلمة المرور
    const hashedPassword = hashPassword(newPassword);
    await db.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    // تحديد الرمز كمستخدم
    await db.passwordReset.update({
      where: { id: resetRecord.id },
      data: { used: true }
    });

    // حذف جميع جلسات المستخدم (إجبار تسجيل الدخول مرة أخرى)
    await db.session.deleteMany({
      where: { userId: user.id }
    });

    // تسجيل العملية
    try {
      await db.securityLog.create({
        data: {
          action: 'password_reset_success',
          identifier: user.identifier,
          details: 'Password reset successfully'
        }
      });
    } catch {
      // Ignore logging errors
    }

    return NextResponse.json({
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح'
    });

  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
