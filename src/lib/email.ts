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

// ========== إيميل موافقة على الحساب (للمستخدم) ==========
export async function sendUserApprovedEmail({ to, name }: { to: string; name: string }) {
  try {
    const { data, error } = await getResend().emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `✅ تم تفعيل حسابك - ${APP_NAME}`,
      html: `
        <!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; direction: rtl; }
          .container { max-width: 480px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #059669, #10b981); padding: 32px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 22px; }
          .content { padding: 32px; text-align: center; }
          .content p { color: #475569; font-size: 15px; line-height: 1.8; }
          .badge { display: inline-block; background: #d1fae5; color: #065f46; padding: 10px 20px; border-radius: 8px; font-size: 14px; margin: 16px 0; }
          .footer { background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; }
          .footer p { color: #94a3b8; font-size: 12px; margin: 4px 0; }
        </style></head><body>
          <div class="container">
            <div class="header"><h1>🎉 تم تفعيل حسابك!</h1><p style="color: rgba(255,255,255,0.9); margin-top: 8px;">مرحباً بك في ${APP_NAME}</p></div>
            <div class="content">
              <p>مرحباً <strong>${name}</strong>،</p>
              <p>بشرى سارة! تمت الموافقة على حسابك بنجاح 🎉</p>
              <div class="badge">✅ الحساب مفعل — يمكنك الآن تسجيل الدخول</div>
              <p>يمكنك الآن نشر عقاراتك والتواصل مع المستخدمين 🏠</p>
            </div>
            <div class="footer"><p>${APP_NAME} - لوحة الشقق الذكية</p></div>
          </div>
        </body></html>
      `,
    });
    if (error) { console.error('Resend error:', error); return { success: false, error: error.message }; }
    console.log(`📧 User approved email sent to ${to}`);
    return { success: true, messageId: data?.id };
  } catch (error: any) { console.error('Error sending user approved email:', error); return { success: false, error: error.message }; }
}

// ========== إيميل رفض التسجيل (للمستخدم) ==========
export async function sendUserRejectedEmail({ to, name, reason }: { to: string; name: string; reason?: string }) {
  try {
    const { data, error } = await getResend().emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `❌ تم رفض تسجيلك - ${APP_NAME}`,
      html: `
        <!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; direction: rtl; }
          .container { max-width: 480px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #dc2626, #ef4444); padding: 32px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 22px; }
          .content { padding: 32px; }
          .content p { color: #475569; font-size: 15px; line-height: 1.8; }
          .info-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 16px 0; }
          .footer { background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; }
          .footer p { color: #94a3b8; font-size: 12px; margin: 4px 0; }
        </style></head><body>
          <div class="container">
            <div class="header"><h1>❌ تم رفض تسجيلك</h1><p style="color: rgba(255,255,255,0.9); margin-top: 8px;">لقد تم مراجعة ورفض طلب التسجيل</p></div>
            <div class="content">
              <p>مرحباً <strong>${name}</strong>،</p>
              <p>للأسف تم رفض طلب تسجيلك في المنصة.</p>
              ${reason ? `<div class="info-box"><p style="margin:0;color:#991b1b;font-size:14px;">📝 <strong>السبب:</strong> ${reason}</p></div>` : ''}
              <p>إذا تعتقد أن هذا خطأ، يمكنك التواصل معنا عبر الموقع 💬</p>
            </div>
            <div class="footer"><p>${APP_NAME} - لوحة الشقق الذكية</p></div>
          </div>
        </body></html>
      `,
    });
    if (error) { console.error('Resend error:', error); return { success: false, error: error.message }; }
    console.log(`📧 User rejected email sent to ${to}`);
    return { success: true, messageId: data?.id };
  } catch (error: any) { console.error('Error sending user rejected email:', error); return { success: false, error: error.message }; }
}

// ========== إيميل حظر المستخدم ==========
export async function sendUserBlockedEmail({ to, name, reason }: { to: string; name: string; reason?: string }) {
  try {
    const { data, error } = await getResend().emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `🚫 تم حظر حسابك - ${APP_NAME}`,
      html: `
        <!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; direction: rtl; }
          .container { max-width: 480px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #b91c1c, #dc2626); padding: 32px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 22px; }
          .content { padding: 32px; }
          .content p { color: #475569; font-size: 15px; line-height: 1.8; }
          .info-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 16px 0; }
          .footer { background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; }
          .footer p { color: #94a3b8; font-size: 12px; margin: 4px 0; }
        </style></head><body>
          <div class="container">
            <div class="header"><h1>🚫 تم حظر حسابك</h1><p style="color: rgba(255,255,255,0.9); margin-top: 8px;">حسابك محظور حالياً</p></div>
            <div class="content">
              <p>مرحباً <strong>${name}</strong>،</p>
              <p>تم حظر حسابك من قبل إدارة المنصة.</p>
              <div class="info-box"><p style="margin:0;color:#991b1b;font-size:14px;">📝 <strong>السبب:</strong> ${reason || 'تم الحظر من قبل الإدارة'}</p></div>
              <p>وقد تم إخفاء جميع عقاراتك المنشورة. إذا تعتقد أن هذا خطأ، تواصل معنا 💬</p>
            </div>
            <div class="footer"><p>${APP_NAME} - لوحة الشقق الذكية</p></div>
          </div>
        </body></html>
      `,
    });
    if (error) { console.error('Resend error:', error); return { success: false, error: error.message }; }
    console.log(`📧 User blocked email sent to ${to}`);
    return { success: true, messageId: data?.id };
  } catch (error: any) { console.error('Error sending user blocked email:', error); return { success: false, error: error.message }; }
}

// ========== إيميل إلغاء حظر المستخدم ==========
export async function sendUserUnblockedEmail({ to, name }: { to: string; name: string }) {
  try {
    const { data, error } = await getResend().emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `✅ تم إلغاء حظر حسابك - ${APP_NAME}`,
      html: `
        <!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; direction: rtl; }
          .container { max-width: 480px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #059669, #10b981); padding: 32px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 22px; }
          .content { padding: 32px; text-align: center; }
          .content p { color: #475569; font-size: 15px; line-height: 1.8; }
          .badge { display: inline-block; background: #d1fae5; color: #065f46; padding: 10px 20px; border-radius: 8px; font-size: 14px; margin: 16px 0; }
          .footer { background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; }
          .footer p { color: #94a3b8; font-size: 12px; margin: 4px 0; }
        </style></head><body>
          <div class="container">
            <div class="header"><h1>✅ تم إلغاء الحظر!</h1><p style="color: rgba(255,255,255,0.9); margin-top: 8px;">حسابك نشط مرة أخرى</p></div>
            <div class="content">
              <p>مرحباً <strong>${name}</strong>،</p>
              <p>تم إلغاء حظر حسابك بنجاح! يمكنك الآن تسجيل الدخول واستخدام المنصة بشكل طبيعي 🎉</p>
              <div class="badge">🔓 الحساب نشط</div>
              <p>عقاراتك ستعود للمراجعة قريباً 🏠</p>
            </div>
            <div class="footer"><p>${APP_NAME} - لوحة الشقق الذكية</p></div>
          </div>
        </body></html>
      `,
    });
    if (error) { console.error('Resend error:', error); return { success: false, error: error.message }; }
    console.log(`📧 User unblocked email sent to ${to}`);
    return { success: true, messageId: data?.id };
  } catch (error: any) { console.error('Error sending user unblocked email:', error); return { success: false, error: error.message }; }
}

// ========== إشعار للمطور: تسجيل مستخدم جديد ==========
export async function sendNewUserRegistrationEmail({ userName, userEmail, phone }: { userName: string; userEmail: string; phone?: string | null }) {
  try {
    const developerEmail = process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com';
    const { data, error } = await getResend().emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [developerEmail],
      subject: `🆕 تسجيل مستخدم جديد - ${APP_NAME}`,
      html: `
        <!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; direction: rtl; }
          .container { max-width: 480px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #2563eb, #3b82f6); padding: 32px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 22px; }
          .content { padding: 32px; }
          .content p { color: #475569; font-size: 15px; line-height: 1.8; }
          .info-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 16px; margin: 16px 0; }
          .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dbeafe; }
          .info-row:last-child { border-bottom: none; }
          .info-label { color: #6b7280; font-size: 14px; }
          .info-value { color: #1e40af; font-weight: 600; font-size: 14px; }
          .footer { background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; }
          .footer p { color: #94a3b8; font-size: 12px; margin: 4px 0; }
        </style></head><body>
          <div class="container">
            <div class="header"><h1>🆕 تسجيل مستخدم جديد</h1><p style="color: rgba(255,255,255,0.9); margin-top: 8px;">بانتظار مراجعتك</p></div>
            <div class="content">
              <p>قام مستخدم جديد بالتسجيل في المنصة:</p>
              <div class="info-box">
                <div class="info-row"><span class="info-label">الاسم</span><span class="info-value">${userName}</span></div>
                <div class="info-row"><span class="info-label">البريد</span><span class="info-value">${userEmail}</span></div>
                ${phone ? `<div class="info-row"><span class="info-label">الهاتف</span><span class="info-value">${phone}</span></div>` : ''}
                <div class="info-row"><span class="info-label">التاريخ</span><span class="info-value">${new Date().toLocaleDateString('ar-EG')}</span></div>
              </div>
              <p>يرجى مراجعة التسجيل والموافقة أو الرفض ⚙️</p>
            </div>
            <div class="footer"><p>${APP_NAME} - إشعارات الإدارة</p></div>
          </div>
        </body></html>
      `,
    });
    if (error) { console.error('Resend error:', error); return { success: false, error: error.message }; }
    console.log(`📧 New registration notification sent to ${developerEmail}`);
    return { success: true, messageId: data?.id };
  } catch (error: any) { console.error('Error sending registration notification:', error); return { success: false, error: error.message }; }
}

// ========== إشعار للمطور: طلب تواصل جديد ==========
export async function sendNewInquiryEmail({ senderName, senderEmail, senderPhone, apartmentTitle }: { senderName: string; senderEmail: string; senderPhone: string; apartmentTitle?: string }) {
  try {
    const developerEmail = process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com';
    const { data, error } = await getResend().emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [developerEmail],
      subject: `📨 طلب تواصل جديد - ${APP_NAME}`,
      html: `
        <!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; direction: rtl; }
          .container { max-width: 480px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #7c3aed, #a855f7); padding: 32px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 22px; }
          .content { padding: 32px; }
          .content p { color: #475569; font-size: 15px; line-height: 1.8; }
          .info-box { background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 12px; padding: 16px; margin: 16px 0; }
          .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ede9fe; }
          .info-row:last-child { border-bottom: none; }
          .info-label { color: #6b7280; font-size: 14px; }
          .info-value { color: #5b21b6; font-weight: 600; font-size: 14px; }
          .footer { background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; }
          .footer p { color: #94a3b8; font-size: 12px; margin: 4px 0; }
        </style></head><body>
          <div class="container">
            <div class="header"><h1>📨 طلب تواصل جديد</h1><p style="color: rgba(255,255,255,0.9); margin-top: 8px;">بانتظار مراجعتك</p></div>
            <div class="content">
              <p>قام مستخدم بطلب تواصل مع مالك عقار:</p>
              <div class="info-box">
                <div class="info-row"><span class="info-label">الاسم</span><span class="info-value">${senderName}</span></div>
                <div class="info-row"><span class="info-label">البريد</span><span class="info-value">${senderEmail}</span></div>
                <div class="info-row"><span class="info-label">الهاتف</span><span class="info-value">${senderPhone}</span></div>
                ${apartmentTitle ? `<div class="info-row"><span class="info-label">العقار</span><span class="info-value">${apartmentTitle}</span></div>` : ''}
              </div>
              <p>يرجى مراجعة الطلب والموافقة أو الرفض ⚙️</p>
            </div>
            <div class="footer"><p>${APP_NAME} - إشعارات الإدارة</p></div>
          </div>
        </body></html>
      `,
    });
    if (error) { console.error('Resend error:', error); return { success: false, error: error.message }; }
    console.log(`📧 New inquiry notification sent to ${developerEmail}`);
    return { success: true, messageId: data?.id };
  } catch (error: any) { console.error('Error sending inquiry notification:', error); return { success: false, error: error.message }; }
}

// ========== إيميل الموافقة على طلب التواصل (للمستخدم) ==========
export async function sendInquiryApprovedEmail({ to, name, apartmentTitle }: { to: string; name: string; apartmentTitle?: string }) {
  try {
    const { data, error } = await getResend().emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `✅ تمت الموافقة على طلب التواصل - ${APP_NAME}`,
      html: `
        <!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; direction: rtl; }
          .container { max-width: 480px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #059669, #10b981); padding: 32px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 22px; }
          .content { padding: 32px; text-align: center; }
          .content p { color: #475569; font-size: 15px; line-height: 1.8; }
          .footer { background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; }
          .footer p { color: #94a3b8; font-size: 12px; margin: 4px 0; }
        </style></head><body>
          <div class="container">
            <div class="header"><h1>✅ تمت الموافقة على طلبك</h1><p style="color: rgba(255,255,255,0.9); margin-top: 8px;">يمكنك الآن التواصل مع المالك</p></div>
            <div class="content">
              <p>مرحباً <strong>${name}</strong>،</p>
              <p>تمت الموافقة على طلب تواصلك${apartmentTitle ? ` بخصوص العقار "${apartmentTitle}"` : ''} ✅</p>
              <p>سجل دخولك للاطلاع على بيانات التواصل 📱</p>
            </div>
            <div class="footer"><p>${APP_NAME} - لوحة الشقق الذكية</p></div>
          </div>
        </body></html>
      `,
    });
    if (error) { console.error('Resend error:', error); return { success: false, error: error.message }; }
    return { success: true, messageId: data?.id };
  } catch (error: any) { console.error('Error sending inquiry approved email:', error); return { success: false, error: error.message }; }
}

// ========== إيميل الموافقة على طلب تعديل ==========
export async function sendEditRequestApprovedEmail({ to, name, apartmentTitle }: { to: string; name: string; apartmentTitle: string }) {
  try {
    const { data, error } = await getResend().emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `✅ تمت الموافقة على تعديلك - ${APP_NAME}`,
      html: `
        <!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; direction: rtl; }
          .container { max-width: 480px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #059669, #10b981); padding: 32px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 22px; }
          .content { padding: 32px; }
          .content p { color: #475569; font-size: 15px; line-height: 1.8; }
          .info-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 16px 0; }
          .footer { background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; }
          .footer p { color: #94a3b8; font-size: 12px; margin: 4px 0; }
        </style></head><body>
          <div class="container">
            <div class="header"><h1>✅ تمت الموافقة على تعديلك</h1><p style="color: rgba(255,255,255,0.9); margin-top: 8px;">تم تطبيق التعديلات بنجاح</p></div>
            <div class="content">
              <p>مرحباً <strong>${name}</strong>،</p>
              <p>تمت الموافقة على طلب تعديلك للعقار "<strong>${apartmentTitle}</strong>" وتم تطبيق التعديلات 🎉</p>
              <div class="info-box"><p style="margin:0;color:#166534;font-size:14px;">✅ التعديلات الآن فعالة ومرئية للمستخدمين</p></div>
            </div>
            <div class="footer"><p>${APP_NAME} - لوحة الشقق الذكية</p></div>
          </div>
        </body></html>
      `,
    });
    if (error) { console.error('Resend error:', error); return { success: false, error: error.message }; }
    return { success: true, messageId: data?.id };
  } catch (error: any) { console.error('Error sending edit approved email:', error); return { success: false, error: error.message }; }
}

// ========== إيميل رفض طلب تعديل ==========
export async function sendEditRequestRejectedEmail({ to, name, apartmentTitle, reason }: { to: string; name: string; apartmentTitle: string; reason?: string }) {
  try {
    const { data, error } = await getResend().emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `❌ تم رفض طلب تعديلك - ${APP_NAME}`,
      html: `
        <!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; direction: rtl; }
          .container { max-width: 480px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #dc2626, #ef4444); padding: 32px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 22px; }
          .content { padding: 32px; }
          .content p { color: #475569; font-size: 15px; line-height: 1.8; }
          .info-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 16px 0; }
          .footer { background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; }
          .footer p { color: #94a3b8; font-size: 12px; margin: 4px 0; }
        </style></head><body>
          <div class="container">
            <div class="header"><h1>❌ تم رفض طلب تعديلك</h1><p style="color: rgba(255,255,255,0.9); margin-top: 8px;">لم يتم تطبيق التعديلات</p></div>
            <div class="content">
              <p>مرحباً <strong>${name}</strong>،</p>
              <p>للأسف تم رفض طلب تعديلك للعقار "<strong>${apartmentTitle}</strong>".</p>
              ${reason ? `<div class="info-box"><p style="margin:0;color:#991b1b;font-size:14px;">📝 <strong>السبب:</strong> ${reason}</p></div>` : ''}
              <p>يمكنك إرسال طلب تعديل جديد إذا أردت 💬</p>
            </div>
            <div class="footer"><p>${APP_NAME} - لوحة الشقق الذكية</p></div>
          </div>
        </body></html>
      `,
    });
    if (error) { console.error('Resend error:', error); return { success: false, error: error.message }; }
    return { success: true, messageId: data?.id };
  } catch (error: any) { console.error('Error sending edit rejected email:', error); return { success: false, error: error.message }; }
}

// ========== إيميل شحن المحفظة ==========
export async function sendWalletTopUpEmail({ to, name, amount, method, newBalance }: { to: string; name: string; amount: number; method?: string; newBalance?: number }) {
  try {
    const { data, error } = await getResend().emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `💰 تم شحن محفظتك - ${APP_NAME}`,
      html: `
        <!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>
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
        </style></head><body>
          <div class="container">
            <div class="header"><h1>💰 تم شحن محفظتك!</h1><p style="color: rgba(255,255,255,0.9); margin-top: 8px;">رصيدك الجديد جاهز</p></div>
            <div class="content">
              <p>مرحباً <strong>${name}</strong>،</p>
              <p>تم شحن محفظتك بنجاح:</p>
              <div class="info-box">
                <div class="info-row"><span class="info-label">المبلغ</span><span class="info-value">${amount.toLocaleString()} ج.م</span></div>
                ${method ? `<div class="info-row"><span class="info-label">طريقة الدفع</span><span class="info-value">${method}</span></div>` : ''}
                ${newBalance !== undefined ? `<div class="info-row"><span class="info-label">الرصيد الجديد</span><span class="info-value">${newBalance.toLocaleString()} ج.م</span></div>` : ''}
              </div>
              <p>يمكنك الآن استخدام رصيدك لدفع رسوم التواصل 🏠</p>
            </div>
            <div class="footer"><p>${APP_NAME} - لوحة الشقق الذكية</p></div>
          </div>
        </body></html>
      `,
    });
    if (error) { console.error('Resend error:', error); return { success: false, error: error.message }; }
    return { success: true, messageId: data?.id };
  } catch (error: any) { console.error('Error sending wallet top-up email:', error); return { success: false, error: error.message }; }
}

// ========== إشعار للمطور: طلب تعديل جديد ==========
export async function sendNewEditRequestEmail({ userName, apartmentTitle, changes }: { userName: string; apartmentTitle: string; changes?: string }) {
  try {
    const developerEmail = process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com';
    const { data, error } = await getResend().emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [developerEmail],
      subject: `✏️ طلب تعديل جديد على عقار - ${APP_NAME}`,
      html: `
        <!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; direction: rtl; }
          .container { max-width: 480px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #d97706, #f59e0b); padding: 32px; text-align: center; }
          .header h1 { color: white; margin: 0; font-size: 22px; }
          .content { padding: 32px; }
          .content p { color: #475569; font-size: 15px; line-height: 1.8; }
          .info-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; margin: 16px 0; }
          .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fef3c7; }
          .info-row:last-child { border-bottom: none; }
          .info-label { color: #6b7280; font-size: 14px; }
          .info-value { color: #92400e; font-weight: 600; font-size: 14px; }
          .footer { background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0; }
          .footer p { color: #94a3b8; font-size: 12px; margin: 4px 0; }
        </style></head><body>
          <div class="container">
            <div class="header"><h1>✏️ طلب تعديل جديد</h1><p style="color: rgba(255,255,255,0.9); margin-top: 8px;">بانتظار مراجعتك</p></div>
            <div class="content">
              <p>قام المستخدم <strong>${userName}</strong> بطلب تعديل على عقار:</p>
              <div class="info-box">
                <div class="info-row"><span class="info-label">العقار</span><span class="info-value">${apartmentTitle}</span></div>
                <div class="info-row"><span class="info-label">بواسطة</span><span class="info-value">${userName}</span></div>
                <div class="info-row"><span class="info-label">التاريخ</span><span class="info-value">${new Date().toLocaleDateString('ar-EG')}</span></div>
              </div>
              ${changes ? `<div class="info-box"><p style="margin:0;color:#92400e;font-size:14px;">📝 ${changes}</p></div>` : ''}
              <p>يرجى مراجعة التعديلات والموافقة أو الرفض ⚙️</p>
            </div>
            <div class="footer"><p>${APP_NAME} - إشعارات الإدارة</p></div>
          </div>
        </body></html>
      `,
    });
    if (error) { console.error('Resend error:', error); return { success: false, error: error.message }; }
    return { success: true, messageId: data?.id };
  } catch (error: any) { console.error('Error sending new edit request notification:', error); return { success: false, error: error.message }; }
}

// Send password changed notification
export async function sendPasswordChangedEmail({ to, name }: { to: string; name: string }) {
  try {
    const { data, error } = await getResend().emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `🔒 تم تغيير كلمة المرور - ${APP_NAME}`,
      html: `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
        <div style="background:linear-gradient(135deg,#7c3aed,#5b21b6);padding:30px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="color:#fff;margin:0;">🔒 تم تغيير كلمة المرور</h1>
        </div>
        <div style="padding:30px;background:#f9fafb;border-radius:0 0 12px 12px;">
          <p>مرحباً <strong>${name}</strong>،</p>
          <p>تم تغيير كلمة المرور الخاصة بحسابك بنجاح.</p>
          <p>إذا لم تقم بهذا التغيير، يرجى التواصل معنا فوراً.</p>
        </div>
      </div>`,
    });
    if (error) { console.error('Resend error:', error); return { success: false, error: error.message }; }
    return { success: true, messageId: data?.id };
  } catch (error: any) { console.error('Error sending password changed email:', error); return { success: false, error: error.message }; }
}
