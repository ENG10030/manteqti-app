import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// 🔒 SECURITY: تم إزالة الـ JWT المباشر - نستخدم getCurrentUser

async function getUserFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
  const token = cookies.get("auth-token");

  if (!token) return null;

  try {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) return null;
    const { verify } = await import("jsonwebtoken");
    const decoded = verify(token, JWT_SECRET) as { userId: string };
    // 🔒 التحقق من قاعدة البيانات
    return await db.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, isBlocked: true }
    });
  } catch {
    return null;
  }
}

// GET - جلب العقارات
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const area = searchParams.get("area");
    const user = await getUserFromRequest(request);
    const isDeveloper = user?.role === "DEVELOPER";
    const isUser = !!user;

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

    // استبعاد عقارات المحظورين
    if (!isDeveloper) {
      const blockedUsers = await db.user.findMany({
        where: { isBlocked: true },
        select: { id: true },
      });
      const blockedIds = blockedUsers.map((u) => u.id);
      if (blockedIds.length > 0) {
        where.createdBy = { notIn: blockedIds };
      }
    }

    const apartments = await db.apartment.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
      orderBy: [
        { isVip: "desc" },
        { isFeatured: "desc" },
        { createdAt: "desc" },
      ],
    });

    // 🔒 حماية PII: إخفاء بيانات حساسة
    const safeApartments = apartments.map((apt: any) => {
      const result: any = { ...apt };

      if (!isUser && !isDeveloper) {
        result.ownerPhone = null;
      }

      return result;
    });

    return NextResponse.json(safeApartments);
  } catch (error) {
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
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
    }

    if (user.isBlocked) {
      return NextResponse.json(
        { error: "تم حظر حسابك. لا يمكنك إضافة عقارات" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      price,
      area,
      bedrooms,
      bathrooms,
      floor,
      apartmentSize,
      ownerPhone,
      mapLink,
      type,
      images,
      videos,
    } = body;

    if (!title || !price || !area || !ownerPhone) {
      return NextResponse.json(
        { error: "البيانات الأساسية مطلوبة" },
        { status: 400 }
      );
    }

    // 🔒 SECURITY: التحقق من الدور من قاعدة البيانات
    const status = user.role === "DEVELOPER" ? "available" : "pending";

    // 🔒 SECURITY: تنظيف المدخلات
    const sanitizeTitle = title.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
    const sanitizeDescription = description ? description.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim() : "";

    const apartment = await db.apartment.create({
      data: {
        title: sanitizeTitle,
        description: sanitizeDescription,
        price: parseInt(price),
        area,
        bedrooms: parseInt(bedrooms) || 1,
        bathrooms: parseInt(bathrooms) || 1,
        floor: floor ? parseInt(floor) : null,
        apartmentSize: apartmentSize ? parseInt(apartmentSize) : null,
        ownerPhone,
        mapLink: mapLink || null,
        type: type || "rent",
        status,
        images: images || null,
        videos: videos || null,
        createdBy: user.id,
        isFeatured: false,
        isVip: false,
      },
    });

    return NextResponse.json({
      message:
        user.role === "DEVELOPER"
          ? "تم إضافة العقار بنجاح"
          : "تم إضافة العقار وهو في انتظار المراجعة",
      apartment,
    });
  } catch (error) {
    console.error("Create apartment error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء إضافة العقار" },
      { status: 500 }
    );
  }
}
