import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ message: "تم تسجيل الخروج بنجاح" });

  response.cookies.set("auth-token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // same بنفس خصائص الكوكي الأصلية (lax) عشان المتصفح يعتبرها نفس الكوكي ويمسحها فعلاً
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
