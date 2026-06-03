import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sign } from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/auth";

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

    if (!user) {
      return NextResponse.json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" }, { status: 401 });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return NextResponse.json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" }, { status: 401 });
    }

    if (user.isBlocked) {
      return NextResponse.json({ error: "تم حظر حسابك. يرجى التواصل مع الإدارة" }, { status: 403 });
    }

    // ⚠️ SECURITY: Check email verification (developers bypass this)
    if (!user.emailVerified && user.role !== 'DEVELOPER') {
      return NextResponse.json({ error: "يجب تأكيد بريدك الإلكتروني أولاً", requiresVerification: true }, { status: 403 });
    }

    const token = sign(
      { userId: user.id, identifier: user.identifier, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const response = NextResponse.json({
      message: "تم تسجيل الدخول بنجاح",
      user: { id: user.id, email: user.email, name: user.name, identifier: user.identifier, role: user.role },
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
