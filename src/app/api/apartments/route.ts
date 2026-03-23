import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// جلب جميع العقارات (مع فلترة للمستخدمين المحظورين)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)
    
    const status = searchParams.get("status")
    const city = searchParams.get("city")
    const type = searchParams.get("type")
    const featured = searchParams.get("featured")

    let whereClause: Record<string, unknown> = {}

    // للمستخدم العادي، لا يرى العقارات المخفية
    if (session?.user?.role !== "developer") {
      whereClause.isHidden = false
    }

    // فلتر حسب الحالة (المطور فقط يرى المعلقة)
    if (status && session?.user?.role === "developer") {
      whereClause.status = status
    } else if (session?.user?.role !== "developer") {
      whereClause.status = "approved"
    }

    if (city) whereClause.city = city
    if (type) whereClause.type = type

    // ترتيب: المميز+ أولاً، ثم المميز، ثم العادي
    const apartments = await db.apartment.findMany({
      where: whereClause,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            isBlocked: true
          }
        }
      },
      orderBy: [
        { featuredType: "desc" }, // featured_plus أولاً
        { isFeatured: "desc" },
        { createdAt: "desc" }
      ]
    })

    // ترتيب مخصص للمميز
    const sortedApartments = apartments.sort((a, b) => {
      // المميز+ أولاً
      if (a.featuredType === "featured_plus" && b.featuredType !== "featured_plus") return -1
      if (b.featuredType === "featured_plus" && a.featuredType !== "featured_plus") return 1
      
      // ثم المميز العادي
      if (a.featuredType === "featured" && !b.featuredType) return -1
      if (b.featuredType === "featured" && !a.featuredType) return 1
      
      // ثم الأحدث
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    return NextResponse.json({ apartments: sortedApartments })

  } catch (error) {
    console.error("Get apartments error:", error)
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب العقارات" },
      { status: 500 }
    )
  }
}

// إضافة عقار جديد
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول أولاً" },
        { status: 401 }
      )
    }

    // التحقق من أن المستخدم غير محظور
    if (session.user.isBlocked) {
      return NextResponse.json(
        { error: "تم حظر حسابك، لا يمكنك إضافة عقارات جديدة" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      title,
      description,
      price,
      area,
      rooms,
      bathrooms,
      address,
      city,
      neighborhood,
      type,
      images
    } = body

    if (!title) {
      return NextResponse.json(
        { error: "العنوان مطلوب" },
        { status: 400 }
      )
    }

    const apartment = await db.apartment.create({
      data: {
        title,
        description,
        price: price ? parseFloat(price) : null,
        area: area ? parseFloat(area) : null,
        rooms: rooms ? parseInt(rooms) : null,
        bathrooms: bathrooms ? parseInt(bathrooms) : null,
        address,
        city,
        neighborhood,
        type,
        images: images ? JSON.stringify(images) : null,
        createdBy: session.user.id, // تعيين createdBy من المستخدم الحالي
        status: session.user.role === "developer" ? "approved" : "pending"
      }
    })

    return NextResponse.json({
      success: true,
      apartment,
      message: session.user.role === "developer" 
        ? "تم إضافة العقار بنجاح" 
        : "تم إرسال العقار للمراجعة"
    })

  } catch (error) {
    console.error("Create apartment error:", error)
    return NextResponse.json(
      { error: "حدث خطأ أثناء إضافة العقار" },
      { status: 500 }
    )
  }
}
