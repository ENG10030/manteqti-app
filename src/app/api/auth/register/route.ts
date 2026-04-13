import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// قائمة نطاقات البريد المؤقتة المحظورة
const BLOCKED_DOMAINS = [
  // Temporary/disposable email services
  'mailinator.com', 'guerrillamail.com', 'guerrillamailblock.com', 'sharklasers.com',
  'guerrillamail.net', 'grr.la', 'dispostable.com', 'trashmail.com', 'trashmail.io',
  'tempmail.com', 'tempmail.io', 'temp-mail.org', 'throwaway.email', 'fakeinbox.com',
  'maildrop.cc', 'mailnesia.com', 'mailcatch.com', 'yopmail.com', 'yopmail.fr',
  'jetable.org', 'mailforspam.com', 'spamgourmet.com', 'mohmal.com', 'tempail.com',
  'emailondeck.com', 'crazymailing.com', 'trashymail.com', 'filzmail.com',
  'incognitomail.org', 'mailnull.com', 'tempinbox.com', 'binkmail.com',
  'safetymail.info', 'spamavert.com', 'mintemail.com', 'mailtothis.com',
  'dispostable.com', 'inboxkitten.com', 'tutanota.com', 'protonmail.com',
  // 10minutemail and similar
  '10minutemail.com', '10minutemail.net', 'tempmailaddress.com',
  // Common fake domains used for testing
  'example.com', 'example.org', 'test.com', 'fake.com', 'invalid.com',
  'notreal.com', 'nomail.com', 'noemail.com', 'nowhere.com',
];

// التحقق من أن نطاق البريد الإلكتروني ليس مؤقتاً أو وهمياً
function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return true;
  
  // Check blocked list
  if (BLOCKED_DOMAINS.includes(domain)) return true;
  
  // Block domains with "temp", "trash", "spam", "fake", "disposable" in name
  const suspiciousKeywords = ['temp', 'trash', 'spam', 'fake', 'disposable', 'throw', 'burner', 'phish'];
  for (const keyword of suspiciousKeywords) {
    if (domain.includes(keyword)) return true;
  }
  
  return false;
}

// التحقق من صحة البريد الإلكتروني بشكل صارم
function isValidEmail(email: string): boolean {
  // Basic format check
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) return false;
  
  // Check TLD is at least 2 characters
  const domain = email.split('@')[1];
  if (!domain) return false;
  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2) return false;
  
  // Block disposable domains
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
      return NextResponse.json(
        { error: "البريد الإلكتروني مستخدم بالفعل" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const isDeveloper = userEmail === "ahmadmamdouh10030@gmail.com";
    
    // Generate OTP for email verification
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    const user = await db.user.create({
      data: {
        name,
        email: userEmail,
        password: hashedPassword,
        phone: phone || null,
        identifier: userEmail,
        role: isDeveloper ? "DEVELOPER" : "USER",
        isApproved: true,
        emailVerified: false,
        otp,
        otpExpires,
      },
    });

    // Log OTP for development (in production, send via email service)
    console.log(`📧 Email verification OTP for ${userEmail}: ${otp}`);

    return NextResponse.json({
      message: "تم إنشاء الحساب بنجاح",
      emailVerificationRequired: true,
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
