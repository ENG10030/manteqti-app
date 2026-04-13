import { NextRequest, NextResponse } from "next/server"
import { verify } from "jsonwebtoken"
import { db } from "@/lib/db"

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

async function getCurrentUser(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
  const token = cookies.get("auth-token");
  if (!token) return null;
  try {
    const decoded = verify(token, JWT_SECRET) as { userId: string };
    return await db.user.findUnique({ where: { id: decoded.userId } });
  } catch {
    return null;
  }
}

// جلب عقارات المستخدم الحالي
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول أولاً" },
        { status: 401 }
      )
    }

    const apartments = await db.apartment.findMany({
      where: {
        createdBy: user.id
      },
      orderBy: {
        createdAt: "desc"
      }
    })

    return NextResponse.json({ apartments })

  } catch (error) {
    console.error("Get my apartments error:", error)
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب عقاراتك" },
      { status: 500 }
    )
  }
}
