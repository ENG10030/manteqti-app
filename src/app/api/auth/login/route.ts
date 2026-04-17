import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sign } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

// Rate limiting بسيط في الذاكرة
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 دقيقة

function isRateLimited(identifier: string): boolean {
  const record = loginAttempts.get(identifier);
  if (!record) return false;
  
  if (Date.now() - record.lastAttempt > LOCKOUT_TIME) {
    loginAttempts.delete(identifier);
    return false;
  }
  
  return record.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(identifier: string): void {
  const record = loginAttempts.get(identifier) || { count: 0, lastAttempt: 0 };
  record.count++;
  record.lastAttempt = Date.now();
  loginAttempts.set(identifier, record);
}

function clearAttempts(identifier: string): void {
  loginAttempts.delete(identifier);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, identifier, password } = body;

    const loginIdentifier = (email || identifier || "").toLowerCase().trim();

    if (!loginIdentifier || !password) {
      return NextResponse.json(
        { error: "البريد الإلكتروني وكلمة المرور مطلوبان" },
        { status: 400 }
      );
    }

    // Rate limiting check
    if (isRateLimited(loginIdentifier)) {
      return NextResponse.json(
        { error: "محاولات كثيرة. حاول بعد 15 دقيقة" },
        { status: 429 }
      );
    }

    const user = await db.user.findUnique({
      where: { identifier: loginIdentifier },
    });

    if (!user) {
      recordFailedAttempt(loginIdentifier);
      return NextResponse.json(
        { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" },
        { status: 401 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      recordFailedAttempt(loginIdentifier);
      return NextResponse.json(
        { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" },
        { status: 401 }
      );
    }

    if (user.isBlocked) {
      return NextResponse.json(
        { error: "تم حظر حسابك. يرجى التواصل مع الإدارة" },
        { status: 403 }
      );
    }

    // مسح محاولات الدخول الفاشلة
    clearAttempts(loginIdentifier);

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
      },
    });

    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء تسجيل الدخول" },
      { status: 500 }
    );
  }
}
