import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sign } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";
const DEVELOPER_EMAIL = (process.env.DEVELOPER_EMAIL || "ahmadmamdouh10030@gmail.com").toLowerCase();

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

    const user = await db.user.findUnique({
      where: { identifier: loginIdentifier },
    });

    if (!user) {
      return NextResponse.json(
        { 
          error: "لا يوجد حساب مسجل بهذا البريد الإلكتروني. يرجى إنشاء حساب أولاً",
          accountNotFound: true 
        },
        { status: 404 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: "كلمة المرور غير صحيحة. يرجى المحاولة مرة أخرى أو إعادة تعيين كلمة المرور" },
        { status: 401 }
      );
    }

    // ╔═══════════════════════════════════════════════════════════╗
    // ║  المطور لا يمكن حظره أبداً                                ║
    // ║  إلغاء أي حظر تلقائياً قبل التحقق                        ║
    // ╚═══════════════════════════════════════════════════════════╝
    const isDeveloper = user.role === 'DEVELOPER' || user.identifier === DEVELOPER_EMAIL;
    
    if (isDeveloper && user.isBlocked) {
      // إلغاء الحظر تلقائياً للمطور
      try {
        await db.user.update({
          where: { id: user.id },
          data: {
            isBlocked: false,
            blockedAt: null,
            blockReason: null,
            isApproved: true,
            role: "DEVELOPER",
            emailVerified: true,
          },
        });
      } catch (fixError) {
        console.error("Failed to unblock developer:", fixError);
      }
    } else if (user.isBlocked) {
      // مستخدم عادي محظور = رفض
      return NextResponse.json(
        { error: "تم حظر حسابك. يرجى التواصل مع الإدارة" },
        { status: 403 }
      );
    }

    // Block login if email not verified (developers exempt)
    if (!user.emailVerified && !isDeveloper) {
      return NextResponse.json({
        error: "لم يتم تأكيد البريد الإلكتروني بعد. يرجى إدخال رمز التحقق الذي تم إرساله إلى بريدك",
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
