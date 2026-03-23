import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// الموافقة على / رفض عقار
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

    const { id: apartmentId } = await params
    const body = await request.json()
    const { action } = body // "approve" or "reject"

    const apartment = await db.apartment.findUnique({
      where: { id: apartmentId },
      include: { creator: true }
    })

    if (!apartment) {
      return NextResponse.json(
        { error: "العقار غير موجود" },
        { status: 404 }
      )
    }

    if (action === "approve") {
      const updatedApartment = await db.apartment.update({
        where: { id: apartmentId },
        data: {
          status: "approved",
          approvedBy: session.user.id,
          approvedAt: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        apartment: updatedApartment,
        message: "تم الموافقة على العقار"
      })

    } else if (action === "reject") {
      const updatedApartment = await db.apartment.update({
        where: { id: apartmentId },
        data: {
          status: "rejected"
        }
      })

      return NextResponse.json({
        success: true,
        apartment: updatedApartment,
        message: "تم رفض العقار"
      })

    } else {
      return NextResponse.json(
        { error: "إجراء غير صالح" },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error("Approve apartment error:", error)
    return NextResponse.json(
      { error: "حدث خطأ أثناء معالجة الطلب" },
      { status: 500 }
    )
  }
}
