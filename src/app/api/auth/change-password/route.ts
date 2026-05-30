import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { sendPasswordChangedEmail } from '@/lib/email';

/**
 * POST /api/auth/change-password
 * Require auth (MUST be logged in). Verify current password matches.
 * Update to new password. Send password changed email notification.
 */
export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyAuth(request);
    if (!decoded) {
      return NextResponse.json({ error: 'غير مصرح - يرجى تسجيل الدخول أولاً' }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'كلمتا المرور غير متطابقتين' }, { status: 400 });
    }

    // Fetch user with password from DB
    const user = await db.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, name: true, email: true, password: true },
    });

    if (!user || !user.password) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'كلمة المرور الحالية غير صحيحة' }, { status: 400 });
    }

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.user.update({
      where: { id: decoded.id },
      data: { password: hashedPassword },
    });

    // Send password change notification email (fire-and-forget)
    const userEmail = user.email;
    if (userEmail) {
      sendPasswordChangedEmail({ to: userEmail, name: user.name }).catch((err) => {
        console.error('Failed to send password changed email:', err);
      });
    }

    // Log password change
    try {
      await db.operationLog.create({
        data: {
          action: 'PASSWORD_CHANGED',
          entityType: 'User',
          entityId: decoded.id,
          details: JSON.stringify({ userId: decoded.id, identifier: decoded.identifier }),
          userId: decoded.id,
        },
      });
    } catch {}

    return NextResponse.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح ✅' });
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تغيير كلمة المرور' }, { status: 500 });
  }
}
