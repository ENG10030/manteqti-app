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
    const pending = searchParams.get("pending")
    const statsParam = searchParams.get("stats")

    // Return aggregated user statistics
    if (statsParam === "true") {
      const [
        totalUsers,
        approvedUsers,
        pendingApprovalUsers,
        blockedUsers,
        emailVerifiedUsers,
        emailUnverifiedUsers,
        todayUsers,
        weekUsers,
        monthUsers,
      ] = await Promise.all([
        db.user.count({ where: { role: "USER" } }),
        db.user.count({ where: { role: "USER", isApproved: true } }),
        db.user.count({ where: { role: "USER", isApproved: false } }),
        db.user.count({ where: { role: "USER", isBlocked: true } }),
        db.user.count({ where: { role: "USER", emailVerified: true } }),
        db.user.count({ where: { role: "USER", emailVerified: false } }),
        db.user.count({ where: { role: "USER", createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
        db.user.count({ where: { role: "USER", createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
        db.user.count({ where: { role: "USER", createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
      ])

      // Get recent registrations (last 10)
      const recentUsers = await db.user.findMany({
        where: { role: "USER" },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          identifier: true,
          isApproved: true,
          isBlocked: true,
          emailVerified: true,
          createdAt: true,
        }
      })

      return NextResponse.json({
        stats: {
          totalUsers,
          approvedUsers,
          pendingApprovalUsers,
          blockedUsers,
          emailVerifiedUsers,
          emailUnverifiedUsers,
          todayUsers,
          weekUsers,
          monthUsers,
        },
        recentUsers,
      })
    }

    const whereClause: Record<string, unknown> = {}

    if (blocked === "true") {
      whereClause.isBlocked = true
    } else if (blocked === "false") {
      whereClause.isBlocked = false
    }

    if (pending === "true") {
      whereClause.isApproved = false
      whereClause.role = "USER"
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
        isApproved: true,
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

// 🔒 POST محمي - لا يمكن إنشاء مستخدمين من هنا
// استخدم /api/auth/register للتسجيل العادي
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: "استخدم صفحة التسجيل لإنشاء حساب جديد", registerUrl: "/register" },
    { status: 403 }
  )
}
