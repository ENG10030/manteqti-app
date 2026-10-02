import { NextResponse } from "next/server";

// ⛔ المسار القديم اتقفل نهائياً (v10.3) — كان ميت بنيوياً (مقارنة OTP نصياً مع bcrypt)
// تأكيد البريد بيتم عبر رمز الاستعادة/الدخول في /api/auth
function gone() {
  return NextResponse.json(
    { error: "هذا المسار القديم اتشال نهائياً" },
    { status: 410 }
  );
}

export async function GET() { return gone(); }
export async function POST() { return gone(); }
