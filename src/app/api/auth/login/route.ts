import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sign } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

export async function POST(request: Request) {
  try {
    console.log('[LOGIN] Starting...');
    console.log('[LOGIN] NODE_ENV:', process.env.NODE_ENV);
    console.log('[LOGIN] DATABASE_URL exists:', !!process.env.DATABASE_URL);

    const body = await request.json();
    const { email, identifier, password } = body;
    const loginIdentifier = (email || identifier || "").toLowerCase().trim();

    console.log('[LOGIN] Identifier:', loginIdentifier);
    console.log('[LOGIN] Password received:', password ? 'yes (6+ chars)' : 'NO');

    if (!loginIdentifier || !password) {
      return NextResponse.json({ error: "البريد الإلكتروني وكلمة المرور مطلوبان" }, { status: 400 });
    }

    console.log('[LOGIN] Searching DB for user:', loginIdentifier);
    // البحث بالإيميل أو رقم الهاتف (الواجهة تقول "البريد الإلكتروني أو رقم الهاتف")
    const user = await db.user.findFirst({
      where: {
        OR: [
          { identifier: loginIdentifier },
          { phone: loginIdentifier },
        ]
      }
    });
    console.log('[LOGIN] User found:', !!user);

    if (!user) {
      return NextResponse.json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة", debug: 'USER_NOT_FOUND' }, { status: 401 });
    }

    console.log('[LOGIN] Comparing password...');
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('[LOGIN] Password valid:', isValidPassword);

    if (!isValidPassword) {
      return NextResponse.json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة", debug: 'WRONG_PASSWORD' }, { status: 401 });
    }

    if (user.isBlocked) {
      return NextResponse.json({ error: "تم حظر حسابك. يرجى التواصل مع الإدارة", debug: 'USER_BLOCKED' }, { status: 403 });
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
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    console.log('[LOGIN] SUCCESS for:', user.identifier);
    return response;
  } catch (error: any) {
    console.error("[LOGIN] FATAL ERROR:", error?.message || error);
    console.error("[LOGIN] Error code:", error?.code);
    console.error("[LOGIN] Error stack:", error?.stack);
    return NextResponse.json({
      error: "حدث خطأ أثناء تسجيل الدخول",
      details: error?.message,
      debug: error?.code || "UNKNOWN"
    }, { status: 500 });
  }
}
