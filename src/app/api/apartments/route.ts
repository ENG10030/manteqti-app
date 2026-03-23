import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

// التحقق من المستخدم
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
    const city = searchParams.get("city");
    const type = searchParams.get("type");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const isFeatured = searchParams.get("featured");
    const isVip = searchParams.get("vip");

    const where: any = {
      status: "AVAILABLE",
    };

    if (city) where.city = { contains: city, mode: "insensitive" };
    if (type) where.type = type;
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }
    if (isFeatured === "true") where.isFeatured = true;
    if (isVip === "true") where.isVip = true;

    // استبعاد عقارات المستخدمين المحظورين
    const blockedUsers = await db.user.findMany({
      where: { isBlocked: true },
      select: { id: true },
    });
    const blockedIds = blockedUsers.map((u) => u.id);
    if (blockedIds.length > 0) {
      where.createdBy = { notIn: blockedIds };
    }

    const apartments = await db.apartment.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, phone: true },
        },
      },
      orderBy: [
        { isVip: "desc" },
        { isFeatured: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({ apartments });
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
      rooms,
      bathrooms,
      city,
      neighborhood,
      address,
      type,
      images,
    } = body;

    if (!title || !price || !city || !type) {
      return NextResponse.json(
        { error: "البيانات الأساسية مطلوبة" },
        { status: 400 }
      );
    }

    // المطور: العقار متاح مباشرة
    // المستخدم: العقار معلق للمراجعة
    const status = user.role === "DEVELOPER" ? "AVAILABLE" : "PENDING";

    const apartment = await db.apartment.create({
      data: {
        title,
        description: description || "",
        price: parseFloat(price),
        area: area ? parseFloat(area) : null,
        rooms: rooms ? parseInt(rooms) : null,
        bathrooms: bathrooms ? parseInt(bathrooms) : null,
        city,
        neighborhood: neighborhood || "",
        address: address || "",
        type,
        status,
        images: images || [],
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
