import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthContext } from "@/lib/auth-middleware";

// GET - جلب العقارات
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const area = searchParams.get("area");
    
    let authResult: Awaited<ReturnType<typeof getAuthContext>> | null = null;
    try {
      authResult = await getAuthContext(request as any);
    } catch (authErr: any) {
      console.warn("Auth check failed, continuing as guest:", authErr.message);
    }
    
    const isDeveloper = authResult?.auth?.role === "DEVELOPER";

    const where: any = {};

    if (status) {
      where.status = status;
    } else if (!isDeveloper) {
      where.status = { in: ["available", "reserved", "sold", "rented"] };
    }

    if (type && type !== "all") {
      where.type = type;
    }
    if (area && area !== "all") {
      where.area = area;
    }

    if (!isDeveloper) {
      try {
        const blockedUserIds = (await db.user.findMany({
          where: { isBlocked: true },
          select: { id: true },
        })).map(u => u.id);
        if (blockedUserIds.length > 0) {
          where.createdBy = { notIn: blockedUserIds };
        }
      } catch (blockErr: any) {
        console.warn("Blocked users check failed:", blockErr.message);
      }
    }

    const apartments = await db.apartment.findMany({
      where,
      include: {
        user: {
          // MEDIUM FIX: Don't expose email publicly
          select: { id: true, name: true },
        },
      },
      orderBy: [
        { featured: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json(apartments);
  } catch (error: any) {
    console.error("Get apartments error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب العقارات" },
      { status: 500 }
    );
  }
}

// POST - إضافة عقار جديد
export async function POST(request: Request) {
  try {
    const { auth, errorResponse } = await getAuthContext(request as any);
    if (errorResponse) return errorResponse;
    if (!auth) {
      return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
    }
    if (!auth.isApproved && auth.role !== 'DEVELOPER') {
      return NextResponse.json(
        { error: "حسابك قيد المراجعة. بانتظار موافقة الإدارة", pendingApproval: true },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      title, description, price, area, bedrooms, bathrooms,
      floor, apartmentSize, ownerPhone, mapLink, type, images, videos,
    } = body;

    if (!title || !price || !area || !ownerPhone) {
      return NextResponse.json({ error: "البيانات الأساسية مطلوبة" }, { status: 400 });
    }

    // MEDIUM FIX: Input validation
    if (typeof title !== 'string' || title.trim().length < 3 || title.length > 200) {
      return NextResponse.json({ error: "العنوان يجب أن يكون بين 3 و 200 حرف" }, { status: 400 });
    }
    if (typeof price !== 'number' && typeof price !== 'string') {
      return NextResponse.json({ error: "السعر غير صالح" }, { status: 400 });
    }
    if (typeof ownerPhone !== 'string' || !/^01[0125][0-9]{8}$/.test(ownerPhone)) {
      return NextResponse.json({ error: "رقم الهاتف غير صالح" }, { status: 400 });
    }

    const aptStatus = auth.role === "DEVELOPER" ? "available" : "pending";

    const apartment = await db.apartment.create({
      data: {
        title: title.trim(),
        description: (description || "").trim().slice(0, 5000),
        price: parseInt(price),
        area: area.trim().slice(0, 100),
        bedrooms: parseInt(bedrooms) || 1,
        bathrooms: parseInt(bathrooms) || 1,
        floor: floor ? parseInt(floor) : null,
        apartmentSize: apartmentSize ? parseInt(apartmentSize) : null,
        ownerPhone,
        mapLink: mapLink || null,
        type: type || "rent",
        status: aptStatus,
        images: images || null,
        videos: videos || null,
        createdBy: auth.userId,
        featured: false,
      },
    });

    return NextResponse.json({
      message: auth.role === "DEVELOPER" ? "تم إضافة العقار بنجاح" : "تم إضافة العقار وهو في انتظار المراجعة",
      apartment,
    });
  } catch (error) {
    console.error("Create apartment error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء إضافة العقار" }, { status: 500 });
  }
}
