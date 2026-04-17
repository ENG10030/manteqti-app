import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Rate limiting per IP
const registerAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_REGISTER_ATTEMPTS = 5;
const REGISTER_LOCKOUT_TIME = 60 * 60 * 1000; // 1 ساعة

function isRegisterRateLimited(ip: string): boolean {
  const record = registerAttempts.get(ip);
  if (!record) return false;
  if (Date.now() - record.lastAttempt > REGISTER_LOCKOUT_TIME) {
    registerAttempts.delete(ip);
    return false;
  }
  return record.count >= MAX_REGISTER_ATTEMPTS;
}

function recordRegisterAttempt(ip: string): void {
  const record = registerAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  record.count++;
  record.lastAttempt = Date.now();
  registerAttempts.set(ip, record);
}

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
    // Rate limiting بالـ IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') || 'unknown';

    if (isRegisterRateLimited(ip)) {
      return NextResponse.json(
        { error: "محاولات تسجيل كثيرة. حاول بعد ساعة" },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { name, email, identifier, password, phone } = body;

    const userEmail = (email || identifier || "").toLowerCase().trim();

    if (!name || !userEmail || !password) {
      return NextResponse.json(
        { error: "الاسم والبريد الإلكتروني وكلمة المرور مطلوبون" },
        { status: 400 }
      );
    }

    // التحقق الصارم من صيغة البريد الإلكتروني
    if (!isValidEmail(userEmail)) {
      return NextResponse.json(
        { error: "صيغة البريد الإلكتروني غير صحيحة أو النطاق غير مسموح به. يرجى استخدام بريد إلكتروني حقيقي (Gmail, Yahoo, Hotmail, إلخ)" },
        { status: 400 }
      );
    }

    // التحقق من قوة كلمة المرور
    if (password.length < 6) {
      return NextResponse.json(
        { error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" },
        { status: 400 }
      );
    }

    // التحقق من طول الاسم
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
      // إذا كان المستخدم موجود لكن غير موثق، أرسل OTP جديد
      if (!existingUser.emailVerified) {
        const otp = crypto.randomInt(100000, 999999).toString();
        const otpExpires = new Date(Date.now() + 30 * 60 * 1000);
        await db.user.update({
          where: { id: existingUser.id },
          data: { otp, otpExpires }
        });
        if (process.env.NODE_ENV === 'development') console.log(`📧 OTP for ${userEmail}: ${otp}`);
        return NextResponse.json({
          message: "حسابك موجود بالفعل. تم إرسال رمز تأكيد جديد",
          emailVerificationRequired: true,
          email: userEmail,
        });
      }
      return NextResponse.json(
        { error: "البريد الإلكتروني مستخدم بالفعل" },
        { status: 400 }
      );
    }

    // تسجيل محاولة التسجيل
    recordRegisterAttempt(ip);

    const hashedPassword = await bcrypt.hash(password, 10);
    const isDeveloper = userEmail === process.env.DEVELOPER_EMAIL;

    // إنشاء OTP للتأكيد
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 دقيقة

    const user = await db.user.create({
      data: {
        name,
        email: userEmail,
        password: hashedPassword,
        phone: phone || null,
        identifier: userEmail,
        role: isDeveloper ? "DEVELOPER" : "USER",
        isApproved: true,
        emailVerified: false, // ⚠️ يجب التأكيد قبل الدخول
        otp,
        otpExpires,
      },
    });

    if (process.env.NODE_ENV === 'development') console.log(`📧 OTP for ${userEmail}: ${otp}`);

    return NextResponse.json({
      message: "تم إنشاء الحساب! يرجى تأكيد البريد الإلكتروني",
      emailVerificationRequired: true,
      email: userEmail,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        identifier: user.identifier,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء إنشاء الحساب" },
      { status: 500 }
    );
  }
}
