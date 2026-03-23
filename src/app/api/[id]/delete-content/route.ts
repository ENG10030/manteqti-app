import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// حذف عقار
export async function DELETE(
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
