import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sign } from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/auth";
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
      return NextResponse.json({ error: "طلبات كثيرة. يرجى المحاولة بعد 15 دقيقة" }, { status: 429 });
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

    // ❌ Case 1: No account found
    if (!user) {
      return NextResponse.json({
        error: "لا يوجد حساب مسجل بهذا البريد الإلكتروني. يرجى إنشاء حساب أولاً",
        code: "USER_NOT_FOUND"
      }, { status: 404 });
    }

    // ❌ Case 2: Wrong password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json({
        error: "كلمة المرور غير صحيحة",
        code: "WRONG_PASSWORD"
      }, { status: 401 });
    }

    // 🚫 Case 5: Account blocked
    if (user.isBlocked) {
      return NextResponse.json({
        error: "تم حظر حسابك. يرجى التواصل مع الإدارة",
        code: "ACCOUNT_BLOCKED",
        blockReason: user.blockReason || null
      }, { status: 403 });
    }

    // ⏳ Case 3: Email not verified → send OTP and return email
    if (!user.emailVerified && user.role !== 'DEVELOPER') {
      // Generate new OTP for verification
      const otp = crypto.randomInt(100000, 999999).toString();
      const otpExpires = new Date(Date.now() + 30 * 60 * 1000);
      const hashedOtp = await bcrypt.hash(otp, 10);

      await db.user.update({
        where: { id: user.id },
        data: { otp: hashedOtp, otpExpires }
      });

      // Try to send OTP email
      try {
        if (process.env.RESEND_API_KEY) {
          const { sendOTPEmail } = await import('@/lib/email');
          await sendOTPEmail({ to: user.email || loginIdentifier, otp, name: user.name });
        } else {
          console.error('⚠️ RESEND_API_KEY not set, OTP email not sent');
        }
      } catch (err: any) {
        console.error('Failed to send OTP on login attempt:', err?.message);
      }

      return NextResponse.json({
        error: "يجب تأكيد بريدك الإلكتروني أولاً",
        code: "EMAIL_NOT_VERIFIED",
        emailVerificationRequired: true,
        email: user.email || loginIdentifier
      }, { status: 403 });
    }

    // ⏳ Case 4: Account not approved
    if (!user.isApproved && user.role !== 'DEVELOPER') {
      return NextResponse.json({
        error: "حسابك قيد المراجعة. بانتظار موافقة الإدارة",
        code: "ACCOUNT_PENDING",
        pendingApproval: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          identifier: user.identifier,
          role: user.role,
          isApproved: false,
          emailVerified: user.emailVerified,
        }
      }, { status: 403 });
    }

    // ✅ Login successful
    const token = sign(
      { userId: user.id, identifier: user.identifier, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const response = NextResponse.json({
      message: "تم تسجيل الدخول بنجاح",
      user: { id: user.id, email: user.email, name: user.name, identifier: user.identifier, role: user.role, isApproved: user.isApproved, emailVerified: user.emailVerified },
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
