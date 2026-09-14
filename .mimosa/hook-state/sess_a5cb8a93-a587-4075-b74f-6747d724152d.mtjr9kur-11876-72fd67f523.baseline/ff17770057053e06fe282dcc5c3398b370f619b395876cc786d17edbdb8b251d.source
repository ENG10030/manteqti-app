import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    // Rate limiting removed (module not available)

    const { token, otp } = await request.json();
    const code = otp || token;

    if (!code) {
      return NextResponse.json({ error: "رمز التأكيد مطلوب" }, { status: 400 });
    }

    const user = await db.user.findFirst({
      where: { otp: code },
    });

    if (!user) {
      return NextResponse.json({ error: "رمز التأكيد غير صحيح" }, { status: 400 });
    }

    if (user.otpExpires && user.otpExpires < new Date()) {
      return NextResponse.json({ error: "انتهت صلاحية رمز التأكيد. يرجى طلب رمز جديد" }, { status: 400 });
    }

    // CRITICAL FIX: Don't verify email for blocked users
    if (user.isBlocked) {
      return NextResponse.json({ error: "حسابك محظور. تواصل مع الإدارة" }, { status: 403 });
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        otp: null,
        otpExpires: null,
      },
    });

    return NextResponse.json({
      message: "تم تأكيد البريد الإلكتروني بنجاح",
    });
  } catch (error) {
    console.error("Verify email error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
