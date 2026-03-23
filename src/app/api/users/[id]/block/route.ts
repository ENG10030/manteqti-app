import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// حظر / إلغاء حظر المستخدم
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== "developer") {
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

    if (targetUser.role === "developer") {
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
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== "developer") {
      return NextResponse.json(
        { error: "غير مصرح لك بهذا الإجراء" },
        { status: 403 }
      )
    }

    const { id: userId } = await params

    const user = await db.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
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
      user,
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
