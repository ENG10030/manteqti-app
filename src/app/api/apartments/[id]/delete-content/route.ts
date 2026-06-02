import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { broadcastEvent, WebhookEvents } from "@/lib/webhook"

// حذف عقار
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

    const { id: apartmentId } = await params

    const apartment = await db.apartment.findUnique({
      where: { id: apartmentId }
    })

    if (!apartment) {
      return NextResponse.json(
        { error: "العقار غير موجود" },
        { status: 404 }
      )
    }

    // حذف العقار
    await db.apartment.delete({
      where: { id: apartmentId }
    })

    try { await broadcastEvent(WebhookEvents.APARTMENTS_CHANGED); } catch {}

    return NextResponse.json({
      success: true,
      message: "تم حذف العقار نهائياً"
    })

  } catch (error) {
    console.error("Delete apartment error:", error)
    return NextResponse.json(
      { error: "حدث خطأ أثناء حذف العقار" },
      { status: 500 }
    )
  }
}
