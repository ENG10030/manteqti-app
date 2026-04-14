import { Resend } from 'resend';

// Initialize Resend client (lazy - only creates instance when API key exists)
let resendInstance: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

interface SendOTPParams {
  to: string;
  otp: string;
  type: 'registration' | 'verification' | 'login';
}

export async function sendOTPEmail({ to, otp, type }: SendOTPParams): Promise<boolean> {
  const resend = getResend();
  
  const subjectMap = {
    registration: 'مرحباً بك في منطقتي - تأكيد البريد الإلكتروني',
    verification: 'تأكيد البريد الإلكتروني - منطقتي',
    login: 'رمز التحقق - منطقتي',
  };

  const messageMap = {
    registration: 'شكراً لانضمامك إلى منطقتي! لتأكيد بريدك الإلكتروني، يرجى إدخال الرمز التالي:',
    verification: 'لتأكيد بريدك الإلكتروني، يرجى إدخال الرمز التالي:',
    login: 'لتسجيل الدخول، يرجى إدخال الرمز التحقق التالي:',
  };

  const html = `
    <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #e11d48; margin: 0; font-size: 28px;">🏠 منطقتي | Manteqti</h1>
        <p style="color: #9ca3af; margin-top: 5px; font-size: 14px;">منصة العقارات المصرية</p>
      </div>
      <div style="background: linear-gradient(135deg, #fff1f2 0%, #fce7f3 100%); border-radius: 16px; padding: 30px; text-align: center;">
        <h2 style="color: #1f2937; margin-bottom: 15px;">${subjectMap[type]}</h2>
        <p style="color: #4b5563; margin-bottom: 25px; font-size: 16px; line-height: 1.6;">
          ${messageMap[type]}
        </p>
        <div style="background: #ffffff; border-radius: 12px; padding: 20px 40px; display: inline-block; box-shadow: 0 4px 15px rgba(225, 29, 72, 0.15);">
          <span style="font-size: 36px; font-weight: bold; color: #e11d48; letter-spacing: 8px;">${otp}</span>
        </div>
        <p style="color: #6b7280; margin-top: 25px; font-size: 14px;">
          هذا الرمز صالح لمدة 30 دقيقة فقط
        </p>
      </div>
      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #f3f4f6;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          إذا لم تقم بطلب هذا الرمز، يمكنك تجاهل هذه الرسالة
        </p>
        <p style="color: #d1d5db; font-size: 11px; margin-top: 10px;">
          © ${new Date().getFullYear()} منطقتي - جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  `;

  // Try Resend first
  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: 'منطقتي <noreply@manteqti.app>',
        to: [to],
        subject: subjectMap[type],
        html,
      });
      if (error) {
        console.error('Resend error:', error);
        return false;
      }
      console.log(`📧 OTP email sent via Resend to ${to}`);
      return true;
    } catch (err) {
      console.error('Resend send error:', err);
    }
  }

  // Fallback: console.log for development
  console.log(`📧 [DEV] Email verification OTP for ${to}: ${otp}`);
  console.log(`📧 [DEV] Resend not configured. Set RESEND_API_KEY in .env to send real emails.`);
  return false;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string, userName: string): Promise<boolean> {
  const resend = getResend();

  const html = `
    <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #e11d48; margin: 0; font-size: 28px;">🏠 منطقتي | Manteqti</h1>
      </div>
      <div style="background: linear-gradient(135deg, #fff1f2 0%, #fce7f3 100%); border-radius: 16px; padding: 30px;">
        <h2 style="color: #1f2937; margin-bottom: 20px;">استعادة كلمة المرور</h2>
        <p style="color: #4b5563; margin-bottom: 20px; line-height: 1.6;">
          مرحباً ${userName}،
        </p>
        <p style="color: #4b5563; margin-bottom: 30px; line-height: 1.6;">
          لقد تلقينا طلباً لاستعادة كلمة المرور الخاصة بحسابك. اضغط على الزر أدناه لتعيين كلمة مرور جديدة:
        </p>
        <div style="text-align: center;">
          <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); color: white; padding: 15px 40px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 16px;">
            استعادة كلمة المرور
          </a>
        </div>
        <p style="color: #6b7280; margin-top: 30px; font-size: 14px;">
          هذا الرابط صالح لمدة ساعة واحدة فقط.
        </p>
      </div>
      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #f3f4f6;">
        <p style="color: #9ca3af; font-size: 12px;">
          إذا لم تطلب استعادة كلمة المرور، يمكنك تجاهل هذه الرسالة.
        </p>
        <p style="color: #d1d5db; font-size: 11px; margin-top: 10px;">
          © ${new Date().getFullYear()} منطقتي - جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  `;

  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: 'منطقتي <noreply@manteqti.app>',
        to: [to],
        subject: 'استعادة كلمة المرور - منطقتي',
        html,
      });
      if (error) {
        console.error('Resend error:', error);
        return false;
      }
      console.log(`📧 Password reset email sent via Resend to ${to}`);
      return true;
    } catch (err) {
      console.error('Resend send error:', err);
    }
  }

  console.log(`📧 [DEV] Password reset URL for ${to}: ${resetUrl}`);
  return false;
}
