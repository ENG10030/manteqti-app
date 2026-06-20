import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sign } from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/auth";
import { sendOTPEmail } from "@/lib/email";
import crypto from "crypto";

// Rate limiting for user login (in-memory)
const loginRateLimit = new Map<string, { count: number; windowStart: number }>();
const MAX_LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginRateLimit.get(ip);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    loginRateLimit.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    return false;
  }
  entry.count += 1;
  return true;
}

export async function POST(request: Request) {
  try {
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkLoginRateLimit(clientIp)) {
      return NextResponse.json({ 
        error: "طلبات كثيرة. يرجى المحاولة بعد 15 دقيقة",
        errorCode: "TOO_MANY_REQUESTS"
      }, { status: 429 });
    }

    const body = await request.json();
    const { email, identifier, password } = body;
    const loginIdentifier = (email || identifier || "").toLowerCase().trim();

    if (!loginIdentifier || !password) {
      return NextResponse.json({ error: "البريد الإلكتروني وكلمة المرور مطلوبان" }, { status: 400 });
    }

    // Input length validation
    if (loginIdentifier.length > 254) {
      return NextResponse.json({ error: "البريد الإلكتروني طويل جداً" }, { status: 400 });
    }
    if (password.length > 128) {
      return NextResponse.json({ error: "كلمة المرور طويلة جداً" }, { status: 400 });
    }

    // البحث بالإيميل أو رقم الهاتف
    const user = await db.user.findFirst({
      where: {
        OR: [
          { identifier: loginIdentifier },
          { phone: loginIdentifier },
        ]
      }
    });

    if (!user) {
      // Generic error to prevent user enumeration
      return NextResponse.json({ 
        error: "بيانات الدخول غير صحيحة",
        errorCode: "INVALID_CREDENTIALS"
      }, { status: 401 });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      // Generic error - same as user not found to prevent enumeration
      return NextResponse.json({ 
        error: "بيانات الدخول غير صحيحة",
        errorCode: "INVALID_CREDENTIALS"
      }, { status: 401 });
    }

    if (user.isBlocked) {
      // ACCOUNT_BLOCKED - حساب محظور مع سبب الحظر
      return NextResponse.json({ 
        error: "تم حظر حسابك. يرجى التواصل مع الإدارة",
        errorCode: "ACCOUNT_BLOCKED",
        blockReason: user.blockReason
      }, { status: 403 });
    }

    // ⚠️ SECURITY: Check email verification (developers bypass this)
    if (!user.emailVerified && user.role !== 'DEVELOPER') {
      // EMAIL_NOT_VERIFIED - يعيد إرسال OTP تلقائياً
      // إعادة إرسال OTP تلقائياً
      try {
        if (process.env.RESEND_API_KEY) {
          const newOtp = crypto.randomInt(100000, 999999).toString();
          const hashedOtp = await bcrypt.hash(newOtp, 10);
          await db.user.update({
            where: { id: user.id },
            data: {
              otp: hashedOtp,
              otpExpires: new Date(Date.now() + 30 * 60 * 1000),
            },
          });
          await sendOTPEmail({ to: user.email || user.identifier, otp: newOtp, name: user.name });
        }
      } catch {
        // فشل إعادة الإرسال لا يمنع الرسالة
      }

      return NextResponse.json({ 
        error: "يجب تأكيد بريدك الإلكتروني أولاً. تم إعادة إرسال رمز التحقق",
        errorCode: "EMAIL_NOT_VERIFIED",
        requiresVerification: true,
        autoOtpSent: true,
        identifier: user.identifier
      }, { status: 403 });
    }

    // ACCOUNT_PENDING - حساب قيد المراجعة (isApproved === false)
    if (user.isApproved === false) {
      return NextResponse.json({ 
        error: "حسابك قيد المراجعة. يرجى الانتظار حتى يتم تأكيد حسابك من قبل الإدارة",
        errorCode: "ACCOUNT_PENDING"
      }, { status: 403 });
    }

    const token = sign(
      { userId: user.id, identifier: user.identifier, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const response = NextResponse.json({
      message: "تم تسجيل الدخول بنجاح",
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        identifier: user.identifier, 
        role: user.role,
        isApproved: user.isApproved,
        emailVerified: user.emailVerified
      },
    });

    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: "حدث خطأ أثناء تسجيل الدخول" }, { status: 500 });
  }
}
