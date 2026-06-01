import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"

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
    
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // لو مفيش body، نفترض approve
      body = { action: "approve" };
    }

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

    if (action === "approve" || !action) {
      const updatedApartment = await db.apartment.update({
        where: { id: apartmentId },
        data: {
          status: "available",
          approvedBy: user.id,
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
        { error: "إجراء غير صالح - استخدم action: approve أو reject" },
        { status: 400 }
      )
    }

  } catch (error: any) {
    console.error("Approve apartment error:", error?.message || error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء معالجة الطلب" },
      { status: 500 }
    )
  }
}
