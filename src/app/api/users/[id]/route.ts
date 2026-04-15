import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"

// حذف المستخدم (للمطور فقط)
export async function DELETE(
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
        { error: "لا يمكن حذف مطور" },
        { status: 400 }
      )
    }

    // حذف المستخدم - سيتم حذف جميع البيانات المرتبطة تلقائياً بسبب onDelete: Cascade
    await db.user.delete({
      where: { id: userId }
    })

    return NextResponse.json({
      success: true,
      message: "تم حذف المستخدم وجميع بياناته بنجاح"
    })

  } catch (error) {
    console.error("Delete user error:", error)
    return NextResponse.json(
      { error: "حدث خطأ أثناء حذف المستخدم" },
      { status: 500 }
    )
  }
}
