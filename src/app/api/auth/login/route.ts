import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { JWT_SECRET, createToken, createAuthResponse } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, identifier, password } = body;

    // Accept either email or identifier
    const loginIdentifier = (email || identifier || "").toLowerCase().trim();

    if (!loginIdentifier || !password) {
      return NextResponse.json(
        { error: "البريد الإلكتروني وكلمة المرور مطلوبان" },
        { status: 400 }
      );
    }

    // Find user by identifier
    const user = await db.user.findUnique({
      where: { identifier: loginIdentifier },
    });

    if (!user) {
      return NextResponse.json(
        { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" },
        { status: 401 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
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

    // SECURITY: Do NOT issue JWT token to unapproved users
    if (!user.isApproved && user.role !== 'DEVELOPER') {
      return NextResponse.json({
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
      // No cookie is set - user cannot access any protected routes
    }

    const token = createToken(
      { userId: user.id, identifier: user.identifier, role: user.role }
    );

    return createAuthResponse({
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
    }, token);

  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء تسجيل الدخول" },
      { status: 500 }
    );
  }
}
