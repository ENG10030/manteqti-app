import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendWelcomeEmail, sendVerificationEmail } from "@/lib/email";

// قائمة نطاقات البريد المؤقتة المحظورة
const BLOCKED_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', 'guerrillamailblock.com', 'sharklasers.com',
  'guerrillamail.net', 'grr.la', 'dispostable.com', 'trashmail.com', 'trashmail.io',
  'tempmail.com', 'tempmail.io', 'temp-mail.org', 'throwaway.email', 'fakeinbox.com',
  'maildrop.cc', 'mailnesia.com', 'mailcatch.com', 'yopmail.com', 'yopmail.fr',
  'jetable.org', 'mailforspam.com', 'spamgourmet.com', 'mohmal.com', 'tempail.com',
  'emailondeck.com', 'crazymailing.com', 'trashymail.com', 'filzmail.com',
  'incognitomail.org', 'mailnull.com', 'tempinbox.com', 'binkmail.com',
  'safetymail.info', 'spamavert.com', 'mintemail.com', 'mailtothis.com',
  'dispostable.com', 'inboxkitten.com',
  '10minutemail.com', '10minutemail.net', 'tempmailaddress.com',
  'example.com', 'example.org', 'test.com', 'fake.com', 'invalid.com',
  'notreal.com', 'nomail.com', 'noemail.com', 'nowhere.com',
];

function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return true;
  if (BLOCKED_DOMAINS.includes(domain)) return true;
  const suspiciousKeywords = ['temp', 'trash', 'spam', 'fake', 'disposable', 'throw', 'burner', 'phish'];
  for (const keyword of suspiciousKeywords) {
    if (domain.includes(keyword)) return true;
  }
  return false;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) return false;
  const domain = email.split('@')[1];
  if (!domain) return false;
  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2) return false;
  if (isDisposableEmail(email)) return false;
  return true;
}

/**
 * توليد رمز OTP مكون من 6 أرقام
 */
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, identifier, password, phone } = body;

    const userEmail = (email || identifier || "").toLowerCase().trim();

    if (!name || !userEmail || !password) {
      return NextResponse.json(
        { error: "الاسم والبريد الإلكتروني وكلمة المرور مطلوبون" },
        { status: 400 }
      );
    }

    if (!isValidEmail(userEmail)) {
      return NextResponse.json(
        { error: "صيغة البريد الإلكتروني غير صحيحة أو النطاق غير مسموح به. يرجى استخدام بريد إلكتروني حقيقي (Gmail, Yahoo, Hotmail, إلخ)" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" },
        { status: 400 }
      );
    }

    if (name.trim().length < 2) {
      return NextResponse.json(
        { error: "الاسم يجب أن يكون حرفين على الأقل" },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findUnique({
      where: { identifier: userEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "البريد الإلكتروني مستخدم بالفعل" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const isDeveloper = userEmail === (process.env.DEVELOPER_EMAIL || "ahmadmamdouh10030@gmail.com");

    // توليد رمز OTP للتأكيد (للمستخدمين العاديين فقط)
    const otp = isDeveloper ? null : generateOTP();
    const otpExpires = isDeveloper ? null : new Date(Date.now() + 10 * 60 * 1000); // 10 دقائق

    const user = await db.user.create({
      data: {
        name,
        email: userEmail,
        password: hashedPassword,
        phone: phone || null,
        identifier: userEmail,
        role: isDeveloper ? "DEVELOPER" : "USER",
        isApproved: isDeveloper,
        emailVerified: isDeveloper,
        otp: otp,
        otpExpires: otpExpires,
      },
    });

    // تسجيل العملية في OperationLog
    try {
      await db.operationLog.create({
        data: {
          action: isDeveloper ? "DEVELOPER_AUTO_REGISTER" : "USER_REGISTER",
          entityType: "User",
          entityId: user.id,
          details: JSON.stringify({
            userName: user.name,
            email: user.email,
            phone: phone || null,
            needsApproval: !isDeveloper,
          }),
          userId: user.id,
        },
      });
    } catch {}

    // ===== إرسال الإيميلات =====
    let emailResults = { welcome: false, verification: false };

    if (!isDeveloper) {
      // إرسال إيميل تأكيد مع رمز OTP (للمستخدمين العاديين)
      try {
        const result = await sendVerificationEmail({
          to: user.email!,
          otp: otp!,
          name: user.name,
        });
        emailResults.verification = result.success;
        console.log(`📧 Verification OTP email result for ${user.email}: ${result.success ? 'SENT ✅' : 'FAILED ❌ - ' + result.error}`);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
      }

      // إرسال إيميل ترحيبي
      try {
        const result = await sendWelcomeEmail({ to: user.email!, name: user.name });
        emailResults.welcome = result.success;
        console.log(`📧 Welcome email result for ${user.email}: ${result.success ? 'SENT ✅' : 'FAILED ❌ - ' + result.error}`);
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
      }
    }

    return NextResponse.json({
      message: isDeveloper 
        ? "تم إنشاء الحساب بنجاح" 
        : "تم إنشاء الحساب بنجاح. تم إرسال رمز التحقق إلى بريدك الإلكتروني.",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        identifier: user.identifier,
        role: user.role,
        isApproved: user.isApproved,
        emailVerified: user.emailVerified,
      },
      // معلومات الإيميلات (للتصحيح فقط في وضع التطوير)
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          otp: otp,
          emailResults,
        }
      }),
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء إنشاء الحساب" },
      { status: 500 }
    );
  }
}
