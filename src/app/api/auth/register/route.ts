import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sign } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

export async function POST(request: Request) {
  try {
    console.log('[REGISTER] Starting...');
    console.log('[REGISTER] DATABASE_URL exists:', !!process.env.DATABASE_URL);

    const body = await request.json();
    const { name, email, identifier, password, phone } = body;

    const userEmail = (email || identifier || "").toLowerCase().trim();

    console.log('[REGISTER] Name:', name);
    console.log('[REGISTER] Email:', userEmail);
    console.log('[REGISTER] Phone:', phone || 'not provided');
    console.log('[REGISTER] Password:', password ? 'yes (6+ chars)' : 'NO');

    if (!name || !userEmail || !password) {
      return NextResponse.json({ error: "الاسم والبريد الإلكتروني وكلمة المرور مطلوبون" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, { status: 400 });
    }

    if (name.trim().length < 2) {
      return NextResponse.json({ error: "الاسم يجب أن يكون حرفين على الأقل" }, { status: 400 });
    }

    console.log('[REGISTER] Checking if user exists:', userEmail);
    const existingUser = await db.user.findUnique({
      where: { identifier: userEmail },
    });
    console.log('[REGISTER] Existing user:', !!existingUser);

    if (existingUser) {
      return NextResponse.json({ error: "البريد الإلكتروني مستخدم بالفعل" }, { status: 400 });
    }

    console.log('[REGISTER] Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);
    const isDeveloper = userEmail === "ahmadmamdouh10030@gmail.com";
    console.log('[REGISTER] Is developer:', isDeveloper);

    console.log('[REGISTER] Creating user in DB...');
    const user = await db.user.create({
      data: {
        name,
        email: userEmail,
        password: hashedPassword,
        phone: phone || null,
        identifier: userEmail,
        role: isDeveloper ? "DEVELOPER" : "USER",
        isApproved: true,
        emailVerified: true,
      },
    });

    console.log('[REGISTER] User created:', user.id, 'role:', user.role);

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
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("[REGISTER] FATAL ERROR:", error?.message || error);
    return NextResponse.json({
      error: "حدث خطأ أثناء إنشاء الحساب",
      details: error?.message,
    }, { status: 500 });
  }
}
