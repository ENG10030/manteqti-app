import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const { identifier, currentPassword, newPassword } = await request.json();

    if (!identifier || !currentPassword || !newPassword) {
      return NextResponse.json({
        error: 'جميع الحقول مطلوبة'
      }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({
        error: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل'
      }, { status: 400 });
    }

    // Find user
    const user = await db.user.findUnique({
      where: { identifier }
    });

    if (!user) {
      return NextResponse.json({
        error: 'المستخدم غير موجود'
      }, { status: 404 });
    }

    // Verify current password
    const hashedCurrentPassword = hashPassword(currentPassword);
    if (user.password !== hashedCurrentPassword) {
      return NextResponse.json({
        error: 'كلمة المرور الحالية غير صحيحة'
      }, { status: 401 });
    }

    // Update password
    const hashedNewPassword = hashPassword(newPassword);
    await db.user.update({
      where: { identifier },
      data: { password: hashedNewPassword }
    });

    return NextResponse.json({
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json({
      error: 'حدث خطأ في تغيير كلمة المرور'
    }, { status: 500 });
  }
}
