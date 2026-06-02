import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";
import { notifyApartmentsChanged } from "@/lib/realtime";
import { broadcastEvent, WebhookEvents } from "@/lib/webhook";
import { JWT_SECRET } from "@/lib/auth";

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

// GET - fetch apartments (public, but with auth check for developer view)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const area = searchParams.get("area");
    
    let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
    try {
      user = await getCurrentUser(request);
    } catch {
      // Continue as guest
    }
    const isDeveloper = user?.role === "DEVELOPER";

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

    // Exclude blocked users' apartments for regular users
    if (!isDeveloper) {
      try {
        const blockedUsers = await db.user.findMany({
          where: { isBlocked: true },
          select: { id: true },
        });
        const blockedIds = blockedUsers.map((u) => u.id);
        if (blockedIds.length > 0) {
          where.createdBy = { notIn: blockedIds };
        }
      } catch {
        // Continue without block filter
      }
    }

    const apartments = await db.apartment.findMany({
      where,
      include: {
        user: {
          // SECURITY: Do NOT expose email in public listings
          select: { id: true, name: true },
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

// POST - create apartment
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

    if (!user.isApproved && user.role !== 'DEVELOPER') {
      return NextResponse.json(
        { error: "حسابك قيد المراجعة. بانتظار موافقة الإدارة", pendingApproval: true },
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

    const apartmentStatus = user.role === "DEVELOPER" ? "available" : "pending";

    const apartment = await db.apartment.create({
      data: {
        title,
        description: description || "",
        price: parseInt(price),
        area,
        bedrooms: parseInt(bedrooms) || 1,
        bathrooms: parseInt(bathrooms) || 1,
        floor: floor ? parseInt(floor) : null,
        apartmentSize: apartmentSize ? parseInt(apartmentSize) : null,
        ownerPhone,
        mapLink: mapLink || null,
        type: type || "rent",
        status: apartmentStatus,
        images: images || null,
        videos: videos || null,
        createdBy: user.id,
        isFeatured: false,
        isVip: false,
      },
    });

    notifyApartmentsChanged('created', apartment.id);
    try { await broadcastEvent(WebhookEvents.APARTMENTS_CHANGED); } catch {}

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
