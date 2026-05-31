import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sign } from "jsonwebtoken";
import { checkRateLimit, recordFailedAttempt } from "@/lib/rate-limit";
import { JWT_SECRET } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL;

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

    // 🔒 Rate limiting — check BEFORE password comparison
    const allowed = await checkRateLimit("login", "email", loginIdentifier, 10, 15 * 60);
    if (!allowed) {
      return NextResponse.json(
        { error: "محاولات كثيرة. حاول بعد 15 دقيقة" },
        { status: 429 }
      );
    }

    const user = await db.user.findUnique({
      where: { identifier: loginIdentifier },
    });

    if (!user) {
      await recordFailedAttempt("login", "email", loginIdentifier, request);
      return NextResponse.json(
        { error: "يجب إنشاء حساب أولاً" },
        { status: 404 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      await recordFailedAttempt("login", "email", loginIdentifier, request);
      return NextResponse.json(
        { error: "كلمة المرور أو البريد الإلكتروني غير صحيحة" },
        { status: 401 }
      );
    }

    if (user.isBlocked) {
      return NextResponse.json(
        { error: "تم حظر حسابك. يرجى التواصل مع الإدارة" },
        { status: 403 }
      );
    }

    // Block login if email not verified (developers and pre-existing users exempt)
    const isDeveloper = user.role === 'DEVELOPER' || (DEVELOPER_EMAIL && user.identifier === DEVELOPER_EMAIL);
    if (!user.emailVerified && !isDeveloper) {
      return NextResponse.json({
        error: "يجب تأكيد البريد الإلكتروني أولاً",
        emailVerificationRequired: true,
        email: user.email || user.identifier,
      }, { status: 403 });
    }

    // Check if user is approved (developers are always approved)
    if (!user.isApproved && !isDeveloper) {
      const token = sign(
        { userId: user.id, identifier: user.identifier, role: user.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      const response = NextResponse.json({
        message: "حسابك قيد المراجعة. بانتظار موافقة الإدارة",
        pendingApproval: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          identifier: user.identifier,
          role: user.role,
          isApproved: false,
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
        emailVerified: user.emailVerified,
        isApproved: user.isApproved,
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
