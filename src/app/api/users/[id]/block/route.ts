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

// حظر / إلغاء حظر المستخدم
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)
    
    if (!user || user.role !== "DEVELOPER") {
      return NextResponse.json(
        { error: "غير مصرح لك بهذا الإجراء" },
        { status: 403 }
      )
    }

    const { id: userId } = await params
    const body = await request.json()
    const { action } = body

    const targetUser = await db.user.findUnique({
      where: { id: userId }
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: "المستخدم غير موجود" },
        { status: 404 }
      )
    }

    if (targetUser.role === "DEVELOPER") {
      return NextResponse.json(
        { error: "لا يمكن حظر مطور" },
        { status: 400 }
      )
    }

    if (action === "block") {
      // حظر المستخدم
      await db.user.update({
        where: { id: userId },
        data: {
          isBlocked: true
        }
      })

      // تحديث حالة عقارات المستخدم إلى "مخفي"
      await db.apartment.updateMany({
        where: { createdBy: userId },
        data: {
          status: "hidden"
        }
      })

      return NextResponse.json({
        success: true,
        message: "تم حظر المستخدم وإخفاء جميع عقاراته"
      })

    } else if (action === "unblock") {
      // إلغاء حظر المستخدم
      await db.user.update({
        where: { id: userId },
        data: {
          isBlocked: false
        }
      })

      return NextResponse.json({
        success: true,
        message: "تم إلغاء حظر المستخدم"
      })

    } else {
      return NextResponse.json(
        { error: "إجراء غير صالح" },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error("Block user error:", error)
    return NextResponse.json(
      { error: "حدث خطأ أثناء معالجة الطلب" },
      { status: 500 }
    )
  }
}

// جلب معلومات المستخدم
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request)
    
    if (!user || user.role !== "DEVELOPER") {
      return NextResponse.json(
        { error: "غير مصرح لك بهذا الإجراء" },
        { status: 403 }
      )
    }

    const { id: userId } = await params

    const userRecord = await db.user.findUnique({
      where: { id: userId }
    })

    if (!userRecord) {
      return NextResponse.json(
        { error: "المستخدم غير موجود" },
        { status: 404 }
      )
    }

    // جلب عقارات المستخدم
    const apartments = await db.apartment.findMany({
      where: { createdBy: userId },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json({
      user: userRecord,
      apartments
    })

  } catch (error) {
    console.error("Get user error:", error)
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب البيانات" },
      { status: 500 }
    )
  }
}
