import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

async function getCurrentUser(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
  const token = cookies.get("auth-token");

  if (!token) return null;

  try {
    const decoded = verify(token, JWT_SECRET) as { userId: string };
    return await db.user.findUnique({
      where: { id: decoded.userId },
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
    const user = await getCurrentUser(request);
    const isDeveloper = user?.role === "DEVELOPER";

    const where: any = {};

    // المطور يرى جميع العقارات، المستخدم العادي يرى العقارات المتاحة والموافق عليها فقط
    if (status) {
      where.status = status;
    } else if (!isDeveloper) {
      where.status = { in: ["available", "reserved", "sold", "rented"] };
    }
    // المطور يرى كل الحالات (لا نضيف شرط للحالة)

    if (type && type !== "all") {
      where.type = type;
    }

    if (area && area !== "all") {
      where.area = area;
    }

    // استبعاد عقارات المحظورين للمستخدمين العاديين
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
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: [
        { isVip: "desc" },
        { isFeatured: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json(apartments);
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
    const user = await getCurrentUser(request);

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

    // المطور ينشر مباشرة، المستخدم العادي يرسل للمراجعة
    const status = user.role === "DEVELOPER" ? "available" : "pending";

    const apartment = await db.apartment.create({
      data: {
        title,
        description: description || "",
        price: parseInt(price),
        area,
        bedrooms: parseInt(bedrooms) || 1,
        bathrooms: parseInt(bathrooms) || 1,
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