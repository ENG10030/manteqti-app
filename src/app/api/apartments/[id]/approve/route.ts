import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic";

// الموافقة على / رفض عقار
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

    const { id: apartmentId } = await params
    const body = await request.json()
    const { action } = body // "approve" or "reject"

    const apartment = await db.apartment.findUnique({
      where: { id: apartmentId }
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
          status: "available",
          approvedBy: user.id,
          approvedAt: new Date()
        }
      })

      // Log approval
      try {
        await db.operationLog.create({
          data: {
            action: "APPROVE_APARTMENT",
            entityType: "Apartment",
            entityId: apartmentId,
            details: JSON.stringify({ title: apartment.title, price: apartment.price, area: apartment.area }),
            userId: user.id,
          },
        });
      } catch {}

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

      // Log rejection
      try {
        await db.operationLog.create({
          data: {
            action: "REJECT_APARTMENT",
            entityType: "Apartment",
            entityId: apartmentId,
            details: JSON.stringify({ title: apartment.title }),
            userId: user.id,
          },
        });
      } catch {}

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
