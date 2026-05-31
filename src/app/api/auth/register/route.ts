import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendOTPEmail, sendNewUserNotificationEmail } from "@/lib/email";

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
      // If user exists but is not verified, resend OTP (don't auto-verify!)
      if (!existingUser.emailVerified && existingUser.role !== 'DEVELOPER') {
        console.log('📧 Unverified user re-registering, resending OTP:', userEmail);
        // Generate new OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const otpExpires = new Date(Date.now() + 30 * 60 * 1000);
        await db.user.update({
          where: { id: existingUser.id },
          data: { otp, otpExpires },
        });
        // Try to send OTP email
        try {
          const emailResult = await sendOTPEmail({ to: userEmail, otp, name: existingUser.name });
          console.log(`📧 Resend OTP result: ${JSON.stringify(emailResult)}`);
        } catch (emailErr) {
          console.error('Failed to resend OTP email:', emailErr);
        }
        return NextResponse.json({
          message: "لديك حساب بالفعل ولكن لم يتم تأكيده. يرجى إدخال رمز التحقق",
          emailVerificationRequired: true,
          email: userEmail,
          user: null, // Don't return user — force OTP verification
        });
      }
      // User exists and is verified
      return NextResponse.json(
        { error: "البريد الإلكتروني مستخدم بالفعل. يرجى تسجيل الدخول بدلاً من ذلك", accountExists: true },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 🔒 SECURITY FIX: Never auto-assign developer role via registration
    // Previously: isDeveloper was determined by email match — removed to prevent privilege escalation

    // Generate OTP for email verification (always required)
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = new Date(Date.now() + 30 * 60 * 1000);

    const user = await db.user.create({
      data: {
        name,
        email: userEmail,
        password: hashedPassword,
        phone: phone || null,
        identifier: userEmail,
        role: 'user', // Never auto-assign developer role via registration
        isApproved: false, // Requires admin approval
        emailVerified: false, // Always requires email verification
        otp,
        otpExpires,
      },
    });

    // Log registration
    try {
      await db.operationLog.create({
        data: {
          action: "USER_REGISTER",
          entityType: "User",
          entityId: user.id,
          details: JSON.stringify({
            userName: user.name,
            email: user.email,
            phone: phone || null,
            needsApproval: true,
            otpSent: true,
          }),
          userId: user.id,
        },
      });
    } catch {}

    // Send OTP email — MUST verify before login
    try {
      const emailResult = await sendOTPEmail({ to: userEmail, otp, name: user.name });
      console.log(`📧 Registration OTP email result: ${JSON.stringify(emailResult)}`);
    } catch (err) {
      console.error('Error sending registration OTP:', err);
    }

    // Send notification email to developer about new registration
    const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com';
    try {
      await sendNewUserNotificationEmail({
        to: DEVELOPER_EMAIL,
        userName: user.name,
        userEmail: user.email || userEmail,
        userPhone: phone || null,
      });
    } catch (err) {
      console.error('Error sending developer notification:', err);
    }

    // ALWAYS require email verification
    return NextResponse.json({
      message: "تم إنشاء الحساب بنجاح! يرجى تأكيد البريد الإلكتروني لإتمام التسجيل",
      emailVerificationRequired: true,
      email: userEmail,
      user: null, // Don't give user session — force OTP first
    });

  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء إنشاء الحساب" },
      { status: 500 }
    );
  }
}
