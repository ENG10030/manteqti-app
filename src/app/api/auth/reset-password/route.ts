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

    // البحث عن المستخدم بالرمز
    const user = await db.user.findFirst({
      where: { passwordResetToken: token }
    });

    if (!user) {
      return NextResponse.json({ error: 'الرمز غير صالح' }, { status: 400 });
    }

    // التحقق من انتهاء الصلاحية
    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return NextResponse.json({ error: 'انتهت صلاحية الرمز' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      email: user.email
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

    // البحث عن المستخدم بالرمز
    const user = await db.user.findFirst({
      where: { passwordResetToken: token }
    });

    if (!user) {
      return NextResponse.json({ error: 'الرمز غير صالح' }, { status: 400 });
    }

    // التحقق من انتهاء الصلاحية
    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return NextResponse.json({ error: 'انتهت صلاحية الرمز' }, { status: 400 });
    }

    // تحديث كلمة المرور ومسح رمز الاستعادة
    const hashedPassword = hashPassword(newPassword);
    await db.user.update({
      where: { id: user.id },
      data: { 
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null
      }
    });

    // تسجيل العملية في OperationLog
    try {
      await db.operationLog.create({
        data: {
          action: 'password_reset_success',
          entityType: 'user',
          entityId: user.id,
          details: 'Password reset successfully',
          userId: user.id
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