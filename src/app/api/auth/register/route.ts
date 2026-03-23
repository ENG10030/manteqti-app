import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, identifier, password, phone } = body;

    // Accept either email or identifier
    const userEmail = (email || identifier || "").toLowerCase().trim();

    if (!name || !userEmail || !password) {
      return NextResponse.json(
        { error: "الاسم والبريد الإلكتروني وكلمة المرور مطلوبون" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: userEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "البريد الإلكتروني مستخدم بالفعل" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if this is the developer
    const isDeveloper = userEmail === "ahmadmamdouh10030@gmail.com";

    const user = await db.user.create({
      data: {
        name,
        email: userEmail,
        password: hashedPassword,
        phone: phone || null,
        identifier: userEmail,
        role: isDeveloper ? "DEVELOPER" : "USER",
        isApproved: true,
      },
    });

    return NextResponse.json({
      message: "تم إنشاء الحساب بنجاح",
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