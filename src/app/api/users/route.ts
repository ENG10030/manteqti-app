import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"

// جلب جميع المستخدمين (للمطور فقط)
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request)

    if (!user || user.role !== "DEVELOPER") {
      return NextResponse.json(
        { error: "غير مصرح لك بهذا الإجراء" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const blocked = searchParams.get("blocked")

    const whereClause: Record<string, unknown> = {}

    if (blocked === "true") {
      whereClause.isBlocked = true
    } else if (blocked === "false") {
      whereClause.isBlocked = false
    }

    const users = await db.user.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "desc"
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        identifier: true,
        role: true,
        isBlocked: true,
        blockedAt: true,
        blockReason: true,
        createdAt: true,
      }
    })

    return NextResponse.json({ users })

  } catch (error) {
    console.error("Get users error:", error)
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب المستخدمين" },
      { status: 500 }
    )
  }
}

// POST محمية - لا يسمح بإنشاء مستخدم مباشرة من هنا
// التسجيل لازم يتم من /api/auth/register فقط
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: "يرجى استخدام صفحة التسجيل" },
    { status: 403 }
  )
}
