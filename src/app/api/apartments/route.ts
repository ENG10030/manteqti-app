import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";
import { notifyApartmentsChanged } from "@/lib/realtime";
import { maybeRunAutoArchive } from "@/lib/auto-archive";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

async function getCurrentUser(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
  const token = cookies.get("auth-token");

  if (!token) return null;

  try {
    const decoded = verify(token, JWT_SECRET!) as unknown as { userId: string };
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
    // أرشفة تلقائية بعد 48 ساعة (تعمل حتى بدون Vercel Cron - مقيّدة بـ throttle داخلي)
    await maybeRunAutoArchive();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const area = searchParams.get("area");
    const archivedParam = searchParams.get("archived");

    let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
    try {
      user = await getCurrentUser(request);
    } catch (authErr: any) {
      console.warn("Auth check failed, continuing as guest:", authErr.message);
    }
    const isDeveloper = user?.role === "DEVELOPER";

    const where: any = {};

    // الأرشفة: افتراضياً لا تُرجع العقارات المؤرشفة لأحد
    // المطور فقط يمكنه طلب archived=true لجلب المؤرشفين فقط
    if (archivedParam === "true") {
      if (!isDeveloper) {
        return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
      }
      where.archivedAt = { not: null };
    } else {
      where.archivedAt = null;
    }

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
      try {
        const blockedUsers = await db.user.findMany({
          where: { isBlocked: true },
          select: { id: true },
        });
        const blockedIds = blockedUsers.map((u) => u.id);
        if (blockedIds.length > 0) {
          where.createdBy = { notIn: blockedIds };
        }
      } catch (blockErr: any) {
        console.warn("Blocked users check failed:", blockErr.message);
      }
    }

    const apartments = await db.apartment.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true },
          // ⛔ SECURITY: Do NOT expose email publicly
        },
      },
      orderBy: [
        { isVip: "desc" },
        { isFeatured: "desc" },
        { createdAt: "desc" },
      ],
    });

    // ⛔ SECURITY: Remove ownerPhone + ownerWhatsapp from public response
    const sanitizedApartments = apartments.map(apt => {
      const { ownerPhone, ownerWhatsapp, ...safeApt } = apt;
      return safeApt;
    });

    return NextResponse.json(sanitizedApartments);
  } catch (error: any) {
    console.error("Get apartments error:", error);
    return NextResponse.json(
      { 
        error: "حدث خطأ أثناء جلب العقارات",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
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

    // Email verification required (developers bypass)
    if (!user.emailVerified && user.role !== 'DEVELOPER') {
      return NextResponse.json(
        { error: "يجب تأكيد بريدك الإلكتروني أولاً. تحقق من صندوق البريد", needVerification: true },
        { status: 403 }
      );
    }

    // Only approved users or developers can create apartments
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
      ownerWhatsapp,
    } = body;

    if (!title || price === undefined || price === null || price === "" || !area || !ownerPhone) {
      return NextResponse.json(
        { error: "البيانات الأساسية مطلوبة" },
        { status: 400 }
      );
    }

    // المطور ينشر مباشرة، المستخدم العادي يرسل للمراجعة
    const status = user.role === "DEVELOPER" ? "available" : "pending";

    // تحويل آمن للسعر (يقبل 0 = عقار مجاني)
    const parsedPrice = parseInt(String(price), 10);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return NextResponse.json({ error: "السعر غير صالح" }, { status: 400 });
    }

    // Sanitize text inputs to prevent XSS in stored data
    const sanitize = (s: string) => s.replace(/<[^>]*>/g, '').trim().slice(0, 500);
    const sanitizedTitle = sanitize(String(title));
    const sanitizedDescription = sanitize(String(description || ""));
    const sanitizedArea = sanitize(String(area));

    const buildData = () => ({
      title: sanitizedTitle,
      description: sanitizedDescription,
      price: parsedPrice,
      area: sanitizedArea,
      bedrooms: parseInt(bedrooms) || 1,
      bathrooms: parseInt(bathrooms) || 1,
      floor: floor ? parseInt(floor) : null,
      apartmentSize: apartmentSize ? parseInt(apartmentSize) : null,
      ownerPhone,
      // رقم واتساب اختياري للناشر — يظهر مع بيانات التواصل بعد الدفع
      ownerWhatsapp: typeof ownerWhatsapp === "string" && ownerWhatsapp.trim()
        ? ownerWhatsapp.replace(/<[^>]*>/g, "").trim().slice(0, 30)
        : null,
      mapLink: mapLink || null,
      type: type || "rent",
      status,
      images: images || null,
      videos: videos || null,
      createdBy: user.id,
      isFeatured: false,
      isVip: false,
    });

    // الإصلاح الذاتي للـ schema drift بيتعمل تلقائياً في src/lib/db.ts
    const apartment = await db.apartment.create({ data: buildData() });

    // Notify all connected clients
    notifyApartmentsChanged('created', apartment.id);

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