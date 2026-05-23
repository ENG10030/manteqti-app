/**
 * Manteqti Email Service - v53
 * Uses Resend (https://resend.com) for reliable email delivery
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://resend.com and create a free account
 * 2. Add your domain (e.g., manteqti.com) or use the free onboarding domain
 * 3. Create an API key from https://resend.com/api-keys
 * 4. Add to Vercel environment variables:
 *    - RESEND_API_KEY=re_xxxxxxxxxxxx
 *    - EMAIL_FROM=noreply@yourdomain.com (or onboarding@resend.dev for testing)
 *    - APP_URL=https://manteqti-app.vercel.app
 * 
 * Free tier: 3,000 emails/month, 100 emails/day
 */

import { Resend } from 'resend';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// Default sender email
const DEFAULT_FROM = process.env.EMAIL_FROM || 'noreply@manteqti.com';

// App URL for links
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://manteqti-app.vercel.app';

/**
 * Send email with error handling and logging
 */
async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY is not configured. Email will not be sent.');
      console.error('   To fix: Add RESEND_API_KEY to your Vercel environment variables');
      console.error('   Get your key from: https://resend.com/api-keys');
      return { success: false, error: 'RESEND_API_KEY not configured' };
    }

    const { data, error } = await resend.emails.send({
      from: params.from || DEFAULT_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      console.error('❌ Failed to send email:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Email sent successfully to ${params.to} (ID: ${data?.id})`);
    return { success: true, messageId: data?.id };
  } catch (err: any) {
    console.error('❌ Email sending error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Generate a styled email HTML template
 */
function emailTemplate(content: string, title: string): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #059669, #0d9488); padding: 30px 20px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; font-weight: 700; }
    .header p { color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px; }
    .body { padding: 30px 20px; }
    .body h2 { color: #1f2937; margin: 0 0 16px; font-size: 20px; }
    .body p { color: #4b5563; line-height: 1.8; margin: 0 0 16px; font-size: 15px; }
    .otp-code { background: #f0fdf4; border: 2px dashed #059669; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
    .otp-code span { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #059669; font-family: 'Courier New', monospace; direction: ltr; }
    .btn { display: inline-block; background: linear-gradient(135deg, #059669, #0d9488); color: white !important; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 10px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb; }
    .footer p { color: #9ca3af; font-size: 12px; margin: 0 0 4px; }
    .footer a { color: #059669; text-decoration: none; }
    .warning { background: #fef3c7; border-right: 4px solid #f59e0b; padding: 12px 16px; border-radius: 8px; margin: 16px 0; }
    .warning p { color: #92400e; font-size: 13px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏠 منطقتي - Manteqti</h1>
      <p>منصة العقارات الأولى في مصر</p>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Manteqti - جميع الحقوق محفوظة</p>
      <p><a href="${APP_URL}">manteqti-app.vercel.app</a></p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send welcome email after registration
 */
export async function sendWelcomeEmail(params: {
  to: string;
  name: string;
}): Promise<{ success: boolean; error?: string }> {
  const { to, name } = params;
  
  const html = emailTemplate(`
    <h2>مرحباً ${name}! 👋</h2>
    <p>تم إنشاء حسابك بنجاح في <strong>منطقتي</strong> - منصة العقارات الأولى في مصر.</p>
    <p>يمكنك الآن:</p>
    <p>• تصفح العقارات المتاحة</p>
    <p>• إضافة عقاراتك الخاصة</p>
    <p>• التواصل مع أصحاب العقارات</p>
    <p>• حفظ المفضلة والتعليق</p>
    ${process.env.EMAIL_FROM?.includes('resend.dev') ? '<div class="warning"><p>⚠️ ملاحظة: هذا إيميل تجريبي (test mode). لتفعيل الإيميلات الحقيقية، قم بإضافة نطاقك في Resend و更新 EMAIL_FROM.</p></div>' : ''}
    <div style="text-align: center; margin: 24px 0;">
      <a href="${APP_URL}" class="btn">🚀 ابدأ الآن</a>
    </div>
    <p>إذا لم تقم بإنشاء هذا الحساب، يرجى تجاهل هذا الإيميل.</p>
  `, 'مرحباً بك في منطقتي');

  return sendEmail({ to, subject: 'مرحباً بك في منطقتي 🏠 - تأكيد التسجيل', html });
}

/**
 * Send OTP email for email verification
 */
export async function sendVerificationEmail(params: {
  to: string;
  otp: string;
  name: string;
}): Promise<{ success: boolean; error?: string }> {
  const { to, otp, name } = params;

  const html = emailTemplate(`
    <h2>تأكيد البريد الإلكتروني 📧</h2>
    <p>مرحباً ${name}،</p>
    <p>يرجى إدخال الكود التالي لتأكيد بريدك الإلكتروني:</p>
    <div class="otp-code">
      <span>${otp}</span>
    </div>
    <div class="warning">
      <p>⏰ هذا الكود صالح لمدة 10 دقائق فقط</p>
      <p>🔒 لا تشارك هذا الكود مع أي شخص</p>
    </div>
    <p>إذا لم تطلب هذا الكود، يرجى تجاهل هذا الإيميل.</p>
  `, 'تأكيد البريد الإلكتروني');

  return sendEmail({ to, subject: `رمز التحقق: ${otp} - منطقتي`, html });
}

/**
 * Send OTP email for password reset
 */
export async function sendOTPEmail(params: {
  to: string;
  otp: string;
  name: string;
}): Promise<{ success: boolean; error?: string }> {
  const { to, otp, name } = params;

  const html = emailTemplate(`
    <h2>استعادة كلمة المرور 🔐</h2>
    <p>مرحباً ${name}،</p>
    <p>طلبنا إعادة تعيين كلمة المرور لحسابك. أدخل الكود التالي:</p>
    <div class="otp-code">
      <span>${otp}</span>
    </div>
    <div class="warning">
      <p>⏰ هذا الكود صالح لمدة ساعة واحدة فقط</p>
      <p>🔒 لا تشارك هذا الكود مع أي شخص</p>
    </div>
    <p>إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا الإيميل. كلمة مرورك لن تتغير.</p>
  `, 'استعادة كلمة المرور');

  return sendEmail({ to, subject: `رمز استعادة كلمة المرور: ${otp} - منطقتي`, html });
}

/**
 * Send account approval notification
 */
export async function sendApprovalEmail(params: {
  to: string;
  name: string;
  approved: boolean;
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { to, name, approved, reason } = params;

  const content = approved
    ? `
      <h2>تم تفعيل حسابك! ✅</h2>
      <p>مرحباً ${name}،</p>
      <p>تم الموافقة على حسابك ويمكنك الآن استخدام جميع ميزات <strong>منطقتي</strong>.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${APP_URL}" class="btn">🏠 ابدأ الآن</a>
      </div>
    `
    : `
      <h2>تم رفض حسابك ❌</h2>
      <p>مرحباً ${name}،</p>
      <p>للأسف تم رفض طلب التسجيل الخاص بك.</p>
      ${reason ? `<p><strong>السبب:</strong> ${reason}</p>` : ''}
      <p>يمكنك المحاولة مرة أخرى أو التواصل مع الإدارة.</p>
    `;

  const html = emailTemplate(content, approved ? 'تم تفعيل حسابك' : 'تم رفض حسابك');

  return sendEmail({
    to,
    subject: approved ? 'تم تفعيل حسابك في منطقتي ✅' : 'إشعار من منطقتي',
    html,
  });
}

/**
 * Send apartment status notification
 */
export async function sendApartmentStatusEmail(params: {
  to: string;
  name: string;
  apartmentTitle: string;
  status: 'approved' | 'rejected';
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { to, name, apartmentTitle, status, reason } = params;

  const content = status === 'approved'
    ? `
      <h2>تم نشر عقارك! 🏠</h2>
      <p>مرحباً ${name}،</p>
      <p>تم الموافقة على نشر عقارك <strong>"${apartmentTitle}"</strong> وهو الآن متاح للجميع.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${APP_URL}" class="btn">👁️ عرض عقارك</a>
      </div>
    `
    : `
      <h2>تم رفض عقارك ❌</h2>
      <p>مرحباً ${name}،</p>
      <p>للأسف تم رفض عقارك <strong>"${apartmentTitle}"</strong>.</p>
      ${reason ? `<p><strong>السبب:</strong> ${reason}</p>` : ''}
      <p>يمكنك تعديل العقار وإعادة إرساله للمراجعة.</p>
    `;

  const html = emailTemplate(content, status === 'approved' ? 'تم نشر عقارك' : 'تم رفض عقارك');

  return sendEmail({
    to,
    subject: status === 'approved'
      ? `تم نشر "${apartmentTitle}" في منطقتي ✅`
      : `إشعار بخصوص "${apartmentTitle}"`,
    html,
  });
}

/**
 * Send payment confirmation email
 */
export async function sendPaymentEmail(params: {
  to: string;
  name: string;
  apartmentTitle: string;
  amount: number;
  currency: string;
  status: 'confirmed' | 'rejected';
}): Promise<{ success: boolean; error?: string }> {
  const { to, name, apartmentTitle, amount, currency, status } = params;

  const content = status === 'confirmed'
    ? `
      <h2>تم تأكيد الدفع! 💰</h2>
      <p>مرحباً ${name}،</p>
      <p>تم تأكيد دفعتك بقيمة <strong>${amount} ${currency}</strong> لعقار <strong>"${apartmentTitle}"</strong>.</p>
      <p>يمكنك الآن عرض بيانات التواصل الخاصة بالعقار.</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="${APP_URL}" class="btn">📞 عرض بيانات التواصل</a>
      </div>
    `
    : `
      <h2>تم رفض الدفع ❌</h2>
      <p>مرحباً ${name}،</p>
      <p>للأسف تم رفض دفعتك لعقار <strong>"${apartmentTitle}"</strong>.</p>
      <p>يرجى المحاولة مرة أخرى أو التواصل مع الإدارة.</p>
    `;

  const html = emailTemplate(content, status === 'confirmed' ? 'تأكيد الدفع' : 'رفض الدفع');

  return sendEmail({
    to,
    subject: status === 'confirmed'
      ? `تأكيد الدفع - ${amount} ${currency} ✅`
      : 'إشعار بخصوص الدفع',
    html,
  });
}

/**
 * Test email configuration - call this from API to verify setup
 */
export async function testEmailConfig(): Promise<{
  success: boolean;
  error?: string;
  details: {
    apiKeySet: boolean;
    fromEmail: string;
    appUrl: string;
  };
}> {
  const details = {
    apiKeySet: !!process.env.RESEND_API_KEY,
    fromEmail: DEFAULT_FROM,
    appUrl: APP_URL,
  };

  if (!process.env.RESEND_API_KEY) {
    return {
      success: false,
      error: 'RESEND_API_KEY not configured. Add it to Vercel environment variables.',
      details,
    };
  }

  return { success: true, details };
}
