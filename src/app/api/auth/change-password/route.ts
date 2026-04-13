import { NextRequest, NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';
import { db } from '@/lib/db';
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

async function getCurrentUser(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
  const token = cookies.get("auth-token");
  if (!token) return null;
  try {
    const decoded = verify(token, JWT_SECRET) as { userId: string };
    return await db.user.findUnique({ where: { id: decoded.userId } });
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json({
        error: 'يجب تسجيل الدخول أولاً'
      }, { status: 401 });
    }

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

    // Find user by identifier
    const targetUser = await db.user.findUnique({
      where: { identifier: identifier }
    });

    if (!targetUser) {
      return NextResponse.json({
        error: 'المستخدم غير موجود'
      }, { status: 404 });
    }

    // Verify the authenticated user is the same as the target user
    if (targetUser.id !== user.id) {
      return NextResponse.json({
        error: 'غير مصرح لك بهذا الإجراء'
      }, { status: 403 });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, targetUser.password);
    if (!isPasswordValid) {
      return NextResponse.json({
        error: 'كلمة المرور الحالية غير صحيحة'
      }, { status: 401 });
    }

    // Update password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await db.user.update({
      where: { id: targetUser.id },
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
