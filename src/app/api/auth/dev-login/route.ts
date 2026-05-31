import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sign } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";
const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || "ahmadmamdouh10030@gmail.com";
const DEVELOPER_PASSWORD = process.env.DEVELOPER_PASSWORD || "admin123";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password } = body;

    // التحقق من كلمة مرور المطور (من Environment Variables)
    if (password !== DEVELOPER_PASSWORD) {
      return NextResponse.json({ error: "كلمة مرور المطور غير صحيحة" }, { status: 401 });
    }

    // Find or create developer account
    let user = await db.user.findUnique({
      where: { identifier: DEVELOPER_EMAIL },
    });

    if (!user) {
      // Auto-create developer account if it doesn't exist
      const hashedPassword = await bcrypt.hash(DEVELOPER_PASSWORD, 10);
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

    // Generate JWT token
    const token = sign(
      { userId: user.id, identifier: user.identifier, role: user.role },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    const response = NextResponse.json({
      message: "تم تسجيل دخول المطور بنجاح",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        identifier: user.identifier,
        role: user.role,
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
  } catch (error) {
    console.error("Dev login error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    available: true,
    email: process.env.DEVELOPER_EMAIL || "ahmadmamdouh10030@gmail.com"
  });
}
