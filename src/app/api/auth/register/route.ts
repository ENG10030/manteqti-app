import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sign } from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, identifier, password, phone } = body;

    const userEmail = (email || identifier || "").toLowerCase().trim();

    if (!name || !userEmail || !password) {
      return NextResponse.json({ error: "الاسم والبريد الإلكتروني وكلمة المرور مطلوبون" }, { status: 400 });
    }

    // Input length validation
    if (userEmail.length > 254) {
      return NextResponse.json({ error: "البريد الإلكتروني طويل جداً" }, { status: 400 });
    }
    if (name.trim().length > 100) {
      return NextResponse.json({ error: "الاسم طويل جداً" }, { status: 400 });
    }
    if (password.length > 128) {
      return NextResponse.json({ error: "كلمة المرور طويلة جداً" }, { status: 400 });
    }
    if (phone && phone.length > 20) {
      return NextResponse.json({ error: "رقم الهاتف طويل جداً" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, { status: 400 });
    }

    if (name.trim().length < 2) {
      return NextResponse.json({ error: "الاسم يجب أن يكون حرفين على الأقل" }, { status: 400 });
    }

    const existingUser = await db.user.findUnique({
      where: { identifier: userEmail },
    });

    if (existingUser) {
      return NextResponse.json({ error: "البريد الإلكتروني مستخدم بالفعل" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await db.user.create({
      data: {
        name,
        email: userEmail,
        password: hashedPassword,
        phone: phone || null,
        identifier: userEmail,
        role: "USER",
        isApproved: true,
        emailVerified: true,
      },
    });

    // Generate JWT and set cookie so user stays logged in after registration
    const token = sign(
      { userId: user.id, identifier: user.identifier, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const response = NextResponse.json({
      message: "تم إنشاء الحساب بنجاح",
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
    return NextResponse.json({ error: "حدث خطأ أثناء إنشاء الحساب" }, { status: 500 });
  }
}
