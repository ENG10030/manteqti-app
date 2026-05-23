import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { sendOTPEmail } from '@/lib/email';

/**
 * توليد رمز OTP مكون من 6 أحرف/أرقام
 */
function generateResetCode(): string {
  // توليد كود من 6 حروف وأرقام سهل القراءة
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // استبعاد الحروف المشابهة: I, O, 0, 1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * إرسال طلب استعادة كلمة المرور
 * POST /api/auth/forgot-password
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'البريد الإلكتروني مطلوب' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // البحث عن المستخدم بهذا البريد
    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { identifier: normalizedEmail }
        ]
      }
    });

    // لأسباب أمنية، لا نكشف إذا كان البريد موجود أم لا
    if (!user) {
      console.log(`📧 Password reset requested for non-existent email: ${normalizedEmail}`);
      return NextResponse.json({
        success: true,
        message: 'إذا كان البريد مسجل، ستصلك رسالة لاستعادة كلمة المرور'
      });
    }

    // توليد رمز OTP للاستعادة
    const otpCode = generateResetCode();
    const token = crypto.randomBytes(32).toString('hex'); // رمز داخلي
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // ساعة واحدة

    // حفظ الرمز في سجل المستخدم
    await db.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expiresAt,
        otp: otpCode,
        otpExpires: expiresAt,
      }
    });

    // ===== إرسال الإيميل =====
    let emailSent = false;
    let emailError = '';

    try {
      const result = await sendOTPEmail({
        to: normalizedEmail,
        otp: otpCode,
        name: user.name,
      });
      emailSent = result.success;
      emailError = result.error || '';
      console.log(`📧 Password reset email to ${normalizedEmail}: ${result.success ? 'SENT ✅' : 'FAILED ❌ - ' + result.error}`);
    } catch (err: any) {
      emailError = err.message;
      console.error('❌ Error sending reset email:', err);
    }

    // تسجيل العملية
    try {
      await db.operationLog.create({
        data: {
          action: 'PASSWORD_RESET_REQUEST',
          entityType: 'User',
          entityId: user.id,
          details: JSON.stringify({
            email: normalizedEmail,
            emailSent,
            emailError: emailError || undefined,
          }),
          userId: user.id,
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      message: emailSent
        ? 'تم إرسال رمز الاستعادة إلى بريدك الإلكتروني ✅'
        : 'إذا كان البريد مسجل، ستصلك رسالة لاستعادة كلمة المرور',
      // معلومات التصحيح فقط في وضع التطوير
      ...(process.env.NODE_ENV === 'development' && {
        otp: otpCode,
        debug: { emailSent, emailError }
      })
    });

  } catch (error) {
    console.error('❌ Error in forgot password:', error);
    return NextResponse.json({ error: 'حدث خطأ. يرجى المحاولة مرة أخرى.' }, { status: 500 });
  }
}

/**
 * التحقق من رمز الاستعادة (اختياري - يمكنك إضافة endpoint منفصل)
 * هذا الكود يمكن استخدامه في الـ frontend مباشرة
 */
// ملاحظة: يمكنك إضافة endpoint VERIFY هنا إذا أردت
// POST /api/auth/forgot-password/verify
// body: { email, code }
// يتحقق من صحة الرمز ويرجع success: true/false
