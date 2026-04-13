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

    if (password.length < 6) {
      return NextResponse.json(
        { error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" },
        { status: 400 }
      );
    }

    // Check if user already exists by identifier
    const existingUser = await db.user.findUnique({
      where: { identifier: userEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "البريد الإلكتروني مستخدم بالفعل" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate 6-digit OTP for email verification
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

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
        emailVerified: isDeveloper, // Developer is auto-verified
        otp: isDeveloper ? null : otp,
        otpExpires: isDeveloper ? null : new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    // TODO: إرسال رمز التأكيد عبر البريد الإلكتروني
    // يمكن استخدام Resend أو SendGrid لإرسال البريد
    // مثال باستخدام Resend:
    // import { Resend } from 'resend';
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'Manteqti <noreply@manteqti.com>',
    //   to: userEmail,
    //   subject: 'رمز تأكيد البريد الإلكتروني - منطقتي',
    //   html: `<h1>رمز التأكيد: ${otp}</h1><p>صالح لمدة 10 دقائق</p>`,
    // });

    return NextResponse.json({
      message: "تم إنشاء الحساب بنجاح. يرجى تأكيد البريد الإلكتروني",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        identifier: user.identifier,
        role: user.role,
      },
      // نعيد رمز OTP لعرضه للمستخدم حتى يتم إعداد خدمة البريد
      otp: isDeveloper ? undefined : otp,
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء إنشاء الحساب" },
      { status: 500 }
    );
  }
}
