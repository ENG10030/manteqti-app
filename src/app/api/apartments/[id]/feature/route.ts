import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// تمييز / إلغاء تمييز عقار
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
    const { action, featuredType } = body 
    // action: "feature" or "unfeature"
    // featuredType: "featured" or "featured_plus"

    const apartment = await db.apartment.findUnique({
      where: { id: apartmentId }
    })

    if (!apartment) {
      return NextResponse.json(
        { error: "العقار غير موجود" },
        { status: 404 }
      )
    }

    if (action === "feature") {
      if (!featuredType || !["featured", "featured_plus"].includes(featuredType)) {
        return NextResponse.json(
          { error: "نوع التمييز غير صالح. يجب أن يكون 'featured' أو 'featured_plus'" },
          { status: 400 }
        )
      }

      const updatedApartment = await db.apartment.update({
        where: { id: apartmentId },
        data: {
          isFeatured: true,
          featuredType: featuredType,
          featuredBy: session.user.id,
          featuredAt: new Date()
        }
      })

      const typeLabel = featuredType === "featured_plus" ? "المميز+" : "المميز"
      
      return NextResponse.json({
        success: true,
        apartment: updatedApartment,
        message: `تم جعل العقار ${typeLabel}`
      })

    } else if (action === "unfeature") {
      const updatedApartment = await db.apartment.update({
        where: { id: apartmentId },
        data: {
          isFeatured: false,
          featuredType: null,
          featuredBy: null,
          featuredAt: null
        }
      })

      return NextResponse.json({
        success: true,
        apartment: updatedApartment,
        message: "تم إلغاء تمييز العقار"
      })

    } else {
      return NextResponse.json(
        { error: "إجراء غير صالح" },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error("Feature apartment error:", error)
    return NextResponse.json(
      { error: "حدث خطأ أثناء معالجة الطلب" },
      { status: 500 }
    )
  }
}
