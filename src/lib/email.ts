import { Resend } from 'resend';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY || '');
  }
  return _resend;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const APP_NAME = 'منطقتي | Manteqti';

interface SendOTPParams {
  to: string;
  otp: string;
  name?: string;
}

interface SendWelcomeParams {
  to: string;
  name: string;
}

interface SendPaymentConfirmedParams {
  to: string;
  name: string;
  apartmentTitle?: string;
  amount: number;
}

// ========== إيميل تأكيد البريد الإلكتروني (Verification OTP) ==========
interface SendVerificationParams {
  to: string;
  otp: string;
  name?: string;
}

export async function sendVerificationEmail({ to, otp, name }: SendVerificationParams) {
  try {
    const { data, error } = await getResend().emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `📧 تأكيد البريد الإلكتروني - رمز التحقق: ${otp}`,
      html: `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; direction: rtl; }
            .container { max-width: 480px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
            .header { background: linear-gradient(135deg, #059669, #10b981); padding: 32px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .header p { color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px; }
            .content { padding: 32px; text-align: center; }
            .greeting { font-size: 16px; color: #334155; margin-bottom: 24px; }
            .otp-box { background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 2px dashed #059669; border-radius: 16px; padding: 24px; margin: 24px 0; }
            .otp-code { font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #059669; font-family: 'Courier New', monospace; direction: ltr; }
            .note { font-size: 13px; color: #94a3b8; margin-top: 16px; }
            .warning { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px; margin: 16px 0; }
            .warning p { color: #92400e; font-size: 13px; margin: 4px 0; }
            .footer { background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; }
            .footer p { color: #94a3b8; font-size: 12px; margin: 4px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📧 تأكيد البريد الإلكتروني</h1>
              <p>مرحباً بك في ${APP_NAME}</p>
            </div>
            <div class="content">
              <p class="greeting">${name ? `مرحباً <strong>${name}</strong>` : 'مرحباً'} 👋</p>
              <p style="color: #475569; font-size: 15px;">أدخل الرمز التالي لتأكيد بريدك الإلكتروني:</p>
              <div class="otp-box">
                <div class="otp-code">${otp}</div>
              </div>
              <div class="warning">
                <p>⏰ الرمز صالح لمدة <strong>10 دقائق</strong> فقط</p>
                <p>🔒 لا تشارك هذا الرمز مع أي شخص</p>
              </div>
            </div>
            <div class="footer">
              <p>تم الإرسال تلقائياً من ${APP_NAME}</p>
              <p>إذا لم تقم بإنشاء حساب، تجاهل هذا البريد</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    if (error) { console.error('Resend error:', error); return { success: false, error: error.message }; }
    console.log(`📧 Verification email sent to ${to}, ID: ${data?.id}`);
    return { success: true, messageId: data?.id };
  } catch (error: any) {
    console.error('Error sending verification email:', error);
    return { success: false, error: error.message };
  }
}

export async function sendOTPEmail({ to, otp, name }: SendOTPParams) {
  try {
    const { data, error } = await getResend().emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `رمز التحقق: ${otp}`,
      html: `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; direction: rtl; }
            .container { max-width: 480px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
            .header { background: linear-gradient(135deg, #7c3aed, #a855f7); padding: 32px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .header p { color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px; }
            .content { padding: 32px; text-align: center; }
            .greeting { font-size: 16px; color: #334155; margin-bottom: 24px; }
            .otp-box { background: linear-gradient(135deg, #f5f3ff, #ede9fe); border: 2px dashed #a855f7; border-radius: 16px; padding: 24px; margin: 24px 0; }
            .otp-code { font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #7c3aed; font-family: 'Courier New', monospace; direction: ltr; }
            .note { font-size: 13px; color: #94a3b8; margin-top: 16px; }
            .footer { background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; }
            .footer p { color: #94a3b8; font-size: 12px; margin: 4px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏠 ${APP_NAME}</h1>
              <p>لوحة الشقق الذكية</p>
            </div>
            <div class="content">
              <p class="greeting">${name ? `مرحباً <strong>${name}</strong>` : 'مرحباً'} 👋</p>
              <p style="color: #475569; font-size: 15px;">استخدم الرمز التالي لتأكيد بريدك الإلكتروني:</p>
              <div class="otp-box">
                <div class="otp-code">${otp}</div>
              </div>
              <p class="note">⏰ الرمز صالح لمدة <strong>30 دقيقة</strong></p>
              <p class="note">🔒 لا تشارك هذا الرمز مع أي شخص</p>
            </div>
            <div class="footer">
              <p>تم الإرسال تلقائياً من ${APP_NAME}</p>
              <p>إذا لم تقم بطلب هذا الرمز، تجاهل هذا البريد</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log(`📧 OTP email sent to ${to}, ID: ${data?.id}`);
    return { success: true, messageId: data?.id };
  } catch (error: any) {
    console.error('Error sending OTP email:', error);
    return { success: false, error: error.message };
  }
}

export async function sendWelcomeEmail({ to, name }: SendWelcomeParams) {
  try {
    const { data, error } = await getResend().emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `مرحباً بك في ${APP_NAME} 🎉`,
      html: `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; direction: rtl; }
            .container { max-width: 480px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
            .header { background: linear-gradient(135deg, #059669, #10b981); padding: 32px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { padding: 32px; text-align: center; }
            .content p { color: #475569; font-size: 15px; line-height: 1.8; }
            .badge { display: inline-block; background: #fef3c7; color: #92400e; padding: 8px 16px; border-radius: 8px; font-size: 14px; margin: 16px 0; }
            .footer { background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; }
            .footer p { color: #94a3b8; font-size: 12px; margin: 4px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 مرحباً ${name}!</h1>
              <p style="color: rgba(255,255,255,0.9); margin-top: 8px;">تم إنشاء حسابك بنجاح</p>
            </div>
            <div class="content">
              <p>أهلاً بك في <strong>${APP_NAME}</strong> - منصتك الأمثل للعقارات</p>
              <div class="badge">⏳ بانتظار موافقة الإدارة على حسابك</div>
              <p>سيتم إشعارك فور تفعيل حسابك</p>
            </div>
            <div class="footer">
              <p>${APP_NAME} - لوحة الشقق الذكية</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error: any) {
    console.error('Error sending welcome email:', error);
    return { success: false, error: error.message };
  }
}

export async function sendPaymentConfirmedEmail({ to, name, apartmentTitle, amount }: SendPaymentConfirmedParams) {
  try {
    const { data, error } = await getResend().emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `✅ تم تأكيد دفعتك - ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; direction: rtl; }
            .container { max-width: 480px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
            .header { background: linear-gradient(135deg, #059669, #10b981); padding: 32px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 22px; }
            .content { padding: 32px; }
            .content p { color: #475569; font-size: 15px; line-height: 1.8; }
            .info-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 16px 0; }
            .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dcfce7; }
            .info-row:last-child { border-bottom: none; }
            .info-label { color: #6b7280; font-size: 14px; }
            .info-value { color: #166534; font-weight: 600; font-size: 14px; }
            .footer { background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; }
            .footer p { color: #94a3b8; font-size: 12px; margin: 4px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ تم تأكيد دفعتك</h1>
              <p style="color: rgba(255,255,255,0.9); margin-top: 8px;">يمكنك الآن الوصول لبيانات التواصل</p>
            </div>
            <div class="content">
              <p>مرحباً <strong>${name}</strong>،</p>
              <p>تم تأكيد دفعتك بنجاح. يمكنك الآن عرض بيانات التواصل للعقار المطلوب.</p>
              <div class="info-box">
                ${apartmentTitle ? `<div class="info-row"><span class="info-label">العقار</span><span class="info-value">${apartmentTitle}</span></div>` : ''}
                <div class="info-row"><span class="info-label">المبلغ</span><span class="info-value">${amount.toLocaleString()} ج.م</span></div>
              </div>
              <p>سجل دخولك واستعرض بيانات التواصل مباشرة 🏠</p>
            </div>
            <div class="footer">
              <p>${APP_NAME} - لوحة الشقق الذكية</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error: any) {
    console.error('Error sending payment confirmed email:', error);
    return { success: false, error: error.message };
  }
}

// ========== إيميل موافقة على عقار ==========
interface SendApartmentApprovedParams {
  to: string;
  name: string;
  apartmentTitle: string;
  apartmentType: string;
  price: number;
  area: string;
}

export async function sendApartmentApprovedEmail({ to, name, apartmentTitle, apartmentType, price, area }: SendApartmentApprovedParams) {
  try {
    const typeLabel = apartmentType === 'rent' ? 'إيجار' : 'بيع';
    const { data, error } = await getResend().emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `✅ تم الموافقة على عقارك - ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head><meta charset="UTF-8"><style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; direction: rtl; }
          .container { max-width: 480px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #059669, #10b981); padding: 32px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 22px; }
          .content { padding: 32px; }
          .content p { color: #475569; font-size: 15px; line-height: 1.8; }
          .info-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 16px 0; }
          .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dcfce7; }
          .info-row:last-child { border-bottom: none; }
          .info-label { color: #6b7280; font-size: 14px; }
          .info-value { color: #166534; font-weight: 600; font-size: 14px; }
          .footer { background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; }
          .footer p { color: #94a3b8; font-size: 12px; margin: 4px 0; }
        </style></head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ تم الموافقة على عقارك!</h1>
              <p style="color: rgba(255,255,255,0.9); margin-top: 8px;">عقارك الآن متاح للمستخدمين</p>
            </div>
            <div class="content">
              <p>مرحباً <strong>${name}</strong>،</p>
              <p>بشرى سارة! تمت الموافقة على إعلانك وظهر الآن في الموقع لجميع المستخدمين 🎉</p>
              <div class="info-box">
                <div class="info-row"><span class="info-label">العقار</span><span class="info-value">${apartmentTitle}</span></div>
                <div class="info-row"><span class="info-label">النوع</span><span class="info-value">${typeLabel}</span></div>
                <div class="info-row"><span class="info-label">المنطقة</span><span class="info-value">${area}</span></div>
                <div class="info-row"><span class="info-label">السعر</span><span class="info-value">${price.toLocaleString()} ج.م</span></div>
              </div>
              <p>يمكنك متابعة تفاعل المستخدمين من لوحة التحكم 📊</p>
            </div>
            <div class="footer"><p>${APP_NAME} - لوحة الشقق الذكية</p></div>
          </div>
        </body>
        </html>
      `,
    });
    if (error) { console.error('Resend error:', error); return { success: false, error: error.message }; }
    return { success: true, messageId: data?.id };
  } catch (error: any) { console.error('Error sending approved email:', error); return { success: false, error: error.message }; }
}

// ========== إيميل رفض عقار ==========
interface SendApartmentRejectedParams {
  to: string;
  name: string;
  apartmentTitle: string;
  reason?: string;
}

export async function sendApartmentRejectedEmail({ to, name, apartmentTitle, reason }: SendApartmentRejectedParams) {
  try {
    const { data, error } = await getResend().emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `❌ تم رفض عقارك - ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head><meta charset="UTF-8"><style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; direction: rtl; }
          .container { max-width: 480px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #dc2626, #ef4444); padding: 32px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 22px; }
          .content { padding: 32px; }
          .content p { color: #475569; font-size: 15px; line-height: 1.8; }
          .info-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 16px 0; }
          .footer { background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; }
          .footer p { color: #94a3b8; font-size: 12px; margin: 4px 0; }
        </style></head>
        <body>
          <div class="container">
            <div class="header">
              <h1>❌ تم رفض إعلانك</h1>
              <p style="color: rgba(255,255,255,0.9); margin-top: 8px;">لقد تم مراجعة ورفض إعلانك</p>
            </div>
            <div class="content">
              <p>مرحباً <strong>${name}</strong>،</p>
              <p>للأسف تم رفض إعلانك "<strong>${apartmentTitle}</strong>" بعد المراجعة.</p>
              ${reason ? `<div class="info-box"><p style="margin:0;color:#991b1b;font-size:14px;">📝 <strong>سبب الرفض:</strong> ${reason}</p></div>` : ''}
              <p>يمكنك تعديل الإعلان وإعادة إرساله مرة أخرى. إذا كان لديك استفسار، تواصل معنا عبر الموقع 💬</p>
            </div>
            <div class="footer"><p>${APP_NAME} - لوحة الشقق الذكية</p></div>
          </div>
        </body>
        </html>
      `,
    });
    if (error) { console.error('Resend error:', error); return { success: false, error: error.message }; }
    return { success: true, messageId: data?.id };
  } catch (error: any) { console.error('Error sending rejected email:', error); return { success: false, error: error.message }; }
}

// ========== إيميل تغيير كلمة المرور ==========
interface SendPasswordChangedParams {
  to: string;
  name: string;
}

export async function sendPasswordChangedEmail({ to, name }: SendPasswordChangedParams) {
  try {
    const { data, error } = await getResend().emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `🔒 تم تغيير كلمة المرور - ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head><meta charset="UTF-8"><style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; direction: rtl; }
          .container { max-width: 480px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #dc2626, #ef4444); padding: 32px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 22px; }
          .content { padding: 32px; text-align: center; }
          .content p { color: #475569; font-size: 15px; line-height: 1.8; }
          .alert-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 16px 0; }
          .alert-box p { margin: 0; color: #991b1b; font-size: 14px; }
          .safe-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 16px 0; }
          .safe-box p { margin: 0; color: #166534; font-size: 14px; }
          .footer { background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; }
          .footer p { color: #94a3b8; font-size: 12px; margin: 4px 0; }
        </style></head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔒 تم تغيير كلمة المرور</h1>
              <p style="color: rgba(255,255,255,0.9); margin-top: 8px;">إشعار أمني من ${APP_NAME}</p>
            </div>
            <div class="content">
              <p>مرحباً <strong>${name}</strong>،</p>
              <p>تم تغيير كلمة المرور لحسابك بنجاح.</p>
              <div class="alert-box">
                <p>⚠️ إذا لم تقم بطلب هذا التغيير، يرجى تواصل معنا فوراً وتغيير كلمة المرور فوراً.</p>
              </div>
              <div class="safe-box">
                <p>✅ إذا كنت أنت من قام بالتغيير، لا حاجة للقلق. كلمة مرورك محمية الآن.</p>
              </div>
            </div>
            <div class="footer"><p>${APP_NAME} - لوحة الشقق الذكية</p></div>
          </div>
        </body>
        </html>
      `,
    });
    if (error) { console.error('Resend error:', error); return { success: false, error: error.message }; }
    return { success: true, messageId: data?.id };
  } catch (error: any) { console.error('Error sending password changed email:', error); return { success: false, error: error.message }; }
}

// ========== إيميل رسالة جديدة ==========
interface SendNewMessageParams {
  to: string;
  name: string;
  senderName: string;
}

export async function sendNewMessageEmail({ to, name, senderName }: SendNewMessageParams) {
  try {
    const { data, error } = await getResend().emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `💬 رسالة جديدة من ${senderName} - ${APP_NAME}`,
      html: `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head><meta charset="UTF-8"><style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; direction: rtl; }
          .container { max-width: 480px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #7c3aed, #a855f7); padding: 32px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 22px; }
          .content { padding: 32px; text-align: center; }
          .content p { color: #475569; font-size: 15px; line-height: 1.8; }
          .sender-box { background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 12px; padding: 16px; margin: 16px 0; }
          .footer { background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; }
          .footer p { color: #94a3b8; font-size: 12px; margin: 4px 0; }
        </style></head>
        <body>
          <div class="container">
            <div class="header">
              <h1>💬 رسالة جديدة</h1>
              <p style="color: rgba(255,255,255,0.9); margin-top: 8px;">لديك رسالة جديدة على ${APP_NAME}</p>
            </div>
            <div class="content">
              <p>مرحباً <strong>${name}</strong>،</p>
              <div class="sender-box">
                <p style="margin:0;color:#5b21b6;font-size:16px;">📨 لديك رسالة جديدة من <strong>${senderName}</strong></p>
              </div>
              <p>سجل دخولك للاطلاع على الرسالة والرد 📱</p>
            </div>
            <div class="footer"><p>${APP_NAME} - لوحة الشقق الذكية</p></div>
          </div>
        </body>
        </html>
      `,
    });
    if (error) { console.error('Resend error:', error); return { success: false, error: error.message }; }
    return { success: true, messageId: data?.id };
  } catch (error: any) { console.error('Error sending message email:', error); return { success: false, error: error.message }; }
}
