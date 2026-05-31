import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sign } from "jsonwebtoken";
import { checkRateLimit, recordFailedAttempt } from "@/lib/rate-limit";
import { JWT_SECRET } from "@/lib/auth";
import crypto from "crypto";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf-8'), Buffer.from(b, 'utf-8'));
  } catch {
    return false;
  }
}

export const dynamic = "force-dynamic";

const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL;
const DEVELOPER_PASSWORD = process.env.DEVELOPER_PASSWORD;

export async function POST(request: Request) {
  try {
    // التحقق من أن المتغيرات البيئية موجودة
    if (!JWT_SECRET || !DEVELOPER_EMAIL || !DEVELOPER_PASSWORD) {
      console.error("Missing required environment variables for dev login");
      return NextResponse.json({ error: "خطأ في إعدادات الخادم" }, { status: 500 });
    }

    const body = await request.json();
    const { password } = body;

    // كلمة المرور مطلوبة
    if (!password) {
      return NextResponse.json({ error: "كلمة المرور مطلوبة" }, { status: 400 });
    }

    // 🔒 Rate limiting BEFORE password comparison
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               request.headers.get("x-real-ip") || "unknown";
    const allowed = await checkRateLimit("dev-login", "ip", ip, 5, 15 * 60);
    if (!allowed) {
      return NextResponse.json({ error: "محاولات كثيرة. حاول بعد 15 دقيقة" }, { status: 429 });
    }

    // التحقق من كلمة مرور المطور فقط من Environment Variables
    if (!safeCompare(password, DEVELOPER_PASSWORD)) {
      await recordFailedAttempt("dev-login", "ip", ip, request);
      return NextResponse.json({ error: "كلمة مرور المطور غير صحيحة" }, { status: 401 });
    }

    // البحث عن حساب المطور في قاعدة البيانات
    let user: { id: string; name: string; email: string | null; role: string } | null = null;

    try {
      user = await db.user.findUnique({
        where: { identifier: DEVELOPER_EMAIL },
      });

      // لو المستخدم مش موجود، انشئه
      if (!user) {
        const hashedPassword = await bcrypt.hash(DEVELOPER_PASSWORD, 12);
        user = await db.user.create({
          data: {
            name: "المطور",
            email: DEVELOPER_EMAIL,
            identifier: DEVELOPER_EMAIL,
            password: hashedPassword,
            role: "DEVELOPER",
            isApproved: true,
            emailVerified: true,
          },
        });
      }
    } catch (dbError: unknown) {
      // 🔐 لو الداتابيز اتعطلت — المطور لازم يقدر يدخل على أي حال
      console.error("DB error in dev login (non-blocking):", dbError instanceof Error ? dbError.message : String(dbError));
    }

    // 🔐 Fallback — حتى لو الداتابيز اتعطلت بالكامل
    const userId = user?.id || "dev-fallback";
    const userRole = user?.role || "DEVELOPER";
    const userName = user?.name || "المطور";
    const userEmail = user?.email || DEVELOPER_EMAIL;

    // Generate JWT token — contains ALL user data so /api/auth/me doesn't need DB
    const token = sign(
      { userId, identifier: DEVELOPER_EMAIL, role: userRole, name: userName, email: userEmail, isApproved: true, emailVerified: true, isBlocked: false },
      JWT_SECRET,
      { expiresIn: "30d", algorithm: "HS256" }
    );

    const response = NextResponse.json({
      message: "تم تسجيل دخول المطور بنجاح",
      user: {
        id: userId,
        email: userEmail,
        name: userName,
        identifier: DEVELOPER_EMAIL,
        role: userRole,
        isApproved: true,
        emailVerified: true,
      },
    });

    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    return response;
  } catch (error: unknown) {
    console.error("Dev login error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({
      error: "حدث خطأ"
    }, { status: 500 });
  }
}
