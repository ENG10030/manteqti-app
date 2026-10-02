import { NextResponse } from "next/server";

// ⛔ المسار القديم اتقفل نهائياً (v10.3) — كان مفتوح بلا مصادقة كاملة
// البديل المحمي بالجلسة والملكية والدور: /api/apartments/[id]
// الرد 410 Gone واضح لأي نداء قديم بدل ما يفضل شغال بلا حماية
function gone() {
  return NextResponse.json(
    { error: "هذا المسار القديم اتشال نهائياً — استخدم /api/apartments/[id] المحمي" },
    { status: 410 }
  );
}

export async function GET() { return gone(); }
export async function POST() { return gone(); }
export async function PUT() { return gone(); }
export async function PATCH() { return gone(); }
export async function DELETE() { return gone(); }
