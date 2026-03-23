import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomBytes } from 'crypto';

// إرسال طلب استعادة كلمة المرور
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
      return NextResponse.json({
        success: true,
        message: 'إذا كان البريد مسجل، ستصلك رسالة لاستعادة كلمة المرور'
      });
    }

    // إنشاء رمز استعادة
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // ساعة واحدة

    // حفظ الرمز في سجل المستخدم مباشرة
    await db.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expiresAt
      }
    });

    // إرسال الإيميل
    const resetUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://manteqti-app.vercel.app'}/reset-password?token=${token}`;
    
    // محاولة إرسال الإيميل عبر Resend
    let emailSent = false;
    try {
      if (process.env.RESEND_API_KEY) {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Manteqti <noreply@manteqti.app>',
            to: normalizedEmail,
            subject: 'استعادة كلمة المرور - منطقتي',
            html: `
              <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <h1 style="color: #7c3aed;">منطقتي | Manteqti</h1>
                </div>
                <div style="background: #f9fafb; border-radius: 12px; padding: 30px;">
                  <h2 style="color: #1f2937; margin-bottom: 20px;">استعادة كلمة المرور</h2>
                  <p style="color: #4b5563; margin-bottom: 20px;">
                    مرحباً ${user.name}،
                  </p>
                  <p style="color: #4b5563; margin-bottom: 30px;">
                    لقد تلقينا طلباً لاستعادة كلمة المرور الخاصة بحسابك. اضغط على الزر أدناه لتعيين كلمة مرور جديدة:
                  </p>
                  <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #9333ea 100%); color: white; padding: 15px 40px; border-radius: 10px; text-decoration: none; font-weight: bold;">
                    استعادة كلمة المرور
                  </a>
                  <p style="color: #6b7280; margin-top: 30px; font-size: 14px;">
                    هذا الرابط صالح لمدة ساعة واحدة فقط.
                  </p>
                  <p style="color: #9ca3af; margin-top: 20px; font-size: 12px;">
                    إذا لم تطلب استعادة كلمة المرور، يمكنك تجاهل هذه الرسالة.
                  </p>
                </div>
                <p style="text-align: center; color: #9ca3af; margin-top: 30px; font-size: 12px;">
                  © 2024 منطقتي - جميع الحقوق محفوظة
                </p>
              </div>
            `
          })
        });
        
        if (response.ok) {
          emailSent = true;
        }
      }
    } catch (emailError) {
      console.error('Error sending email:', emailError);
    }

    return NextResponse.json({
      success: true,
      message: 'إذا كان البريد مسجل، ستصلك رسالة لاستعادة كلمة المرور',
      // في بيئة التطوير، نرجع الرابط للتجربة
      ...(process.env.NODE_ENV === 'development' && { resetUrl, token })
    });

  } catch (error) {
    console.error('Error in forgot password:', error);
    return NextResponse.json({ error: 'حدث خطأ. يرجى المحاولة مرة أخرى.' }, { status: 500 });
  }
}