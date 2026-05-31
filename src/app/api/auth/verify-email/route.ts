import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    // HIGH FIX: Add rate limiting to prevent OTP brute-force
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const allowed = await checkRateLimit("verify-email", "ip", ip, 10, 15 * 60);
    if (!allowed) {
      return NextResponse.json(
        { error: "محاولات كثيرة. حاول بعد 15 دقيقة" },
        { status: 429 }
      );
    }

    const { token, otp } = await request.json();
    const code = otp || token;

    if (!code || typeof code !== 'string' || code.length !== 6) {
      return NextResponse.json({ error: "رمز التأكيد مطلوب (6 أرقام)" }, { status: 400 });
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

    await db.user.update({
      where: { id: user.id },
      data: { emailVerified: true, otp: null, otpExpires: null },
    });

    return NextResponse.json({ message: "تم تأكيد البريد الإلكتروني بنجاح" });
  } catch (error) {
    console.error("Verify email error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
