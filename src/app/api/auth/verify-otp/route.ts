import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendVerificationEmail } from '@/lib/email';

/**
 * توليد رمز OTP مكون من 6 أرقام
 */
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * التحقق من رمز OTP لتأكيد البريد الإلكتروني
 * POST /api/auth/verify-otp
 * Body: { identifier: string, otp: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { identifier, otp } = body;

    if (!identifier || !otp) {
      return NextResponse.json({ error: 'البريد الإلكتروني والرمز مطلوبان' }, { status: 400 });
    }

    const normalizedIdentifier = identifier.toLowerCase().trim();

    // البحث عن المستخدم
    const user = await db.user.findUnique({
      where: { identifier: normalizedIdentifier },
    });

    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    // التحقق من الرمز
    if (user.otp !== otp) {
      return NextResponse.json({ error: 'رمز التأكيد غير صحيح ❌' }, { status: 400 });
    }

    // التحقق من انتهاء الصلاحية
    if (user.otpExpires && new Date() > user.otpExpires) {
      return NextResponse.json({ error: 'انتهت صلاحية الرمز. يرجى طلب رمز جديد ⏰' }, { status: 400 });
    }

    // تأكيد البريد الإلكتروني
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        otp: null,
        otpExpires: null,
      },
    });

    // تسجيل العملية
    try {
      await db.operationLog.create({
        data: {
          action: 'EMAIL_VERIFIED',
          entityType: 'User',
          entityId: user.id,
          details: JSON.stringify({ email: user.email }),
          userId: user.id,
        },
      });
    } catch {}

    return NextResponse.json({
      message: 'تم تأكيد البريد الإلكتروني بنجاح! ✅',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        identifier: updatedUser.identifier,
        role: updatedUser.role,
        isApproved: updatedUser.isApproved,
        emailVerified: updatedUser.emailVerified,
      },
    });

  } catch (error) {
    console.error('❌ Error verifying OTP:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء التحقق' }, { status: 500 });
  }
}
