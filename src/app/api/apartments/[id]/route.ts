import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";
import { notifyApartmentsChanged } from "@/lib/realtime";
import { sendApartmentApprovedEmail, sendApartmentRejectedEmail } from "@/lib/email";

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

// ===== تحويلات آمنة =====
// ⚠️ Bug fix سابق: `body.price ? parseFloat(body.price) : undefined`
// كان يمنع حفظ السعر 0 (عقار مجاني) لأن 0 falsy، وأيضاً parseInt('') = NaN
// كان يفشل التحديث كله. هذه الدوال تفرق بين "لم يُرسل" و"فارغ" و"0".

// لحقول مطلوبة (Int) — ترجع undefined لو لم تُرسل/فارغة/غير صالحة (يتجاهلها Prisma)
function toNumUpdate(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isNaN(n) ? undefined : n;
}

// لحقول Int القابلة لـ null (floor/apartmentSize) — فارغ أو غير صالح → null (مسح القيمة)
function toNullableIntUpdate(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = typeof v === 'number' ? Math.trunc(v) : parseInt(String(v), 10);
  return isNaN(n) ? null : n;
}

// لحقول نصية قابلة لـ null (ownerWhatsapp) — فارغ → null (مسح الرقم)
function toNullableTextUpdate(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).replace(/<[^>]*>/g, '').trim().slice(0, 30);
  return s || null;
}

// GET - جلب عقار واحد
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const apartment = await db.apartment.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, phone: true, email: true },
        },
      },
    });

    if (!apartment) {
      return NextResponse.json({ error: "العقار غير موجود" }, { status: 404 });
    }

    return NextResponse.json({ apartment });
  } catch (error) {
    console.error("Get apartment error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب العقار" },
      { status: 500 }
    );
  }
}

// PUT - تحديث عقار
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const apartment = await db.apartment.findUnique({
      where: { id },
    });

    if (!apartment) {
      return NextResponse.json({ error: "العقار غير موجود" }, { status: 404 });
    }

    if (apartment.createdBy !== user.id && user.role !== "DEVELOPER") {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
    }

    // Prevent non-developers from setting privileged fields
    if (user.role !== 'DEVELOPER') {
      delete body.isFeatured;
      delete body.isVip;
      delete body.status;
    }

    // إدارة الأرشفة التلقائية (بعد 48 ساعة في الحالات النهائية)
    const FINAL_STATUSES = ['sold', 'rented', 'unavailable'];
    let statusChangedAtData: Date | null | undefined = undefined;
    let archivedAtData: Date | null | undefined = undefined;

    if (body.status !== undefined) {
      if (FINAL_STATUSES.includes(body.status)) {
        // انتقل لحالة نهائية: ابدأ عدّاد الـ 48 ساعة
        statusChangedAtData = body.statusChangedAt ? new Date(body.statusChangedAt) : new Date();
      } else {
        // رجع لحالة نشطة: صفّر العدّاد واستعد من الأرشيف تلقائياً
        statusChangedAtData = null;
        archivedAtData = null;
      }
    } else if (body.statusChangedAt !== undefined) {
      statusChangedAtData = body.statusChangedAt ? new Date(body.statusChangedAt) : null;
    }

    // استعادة صريحة من الأرشيف
    if (body.archived === false) {
      archivedAtData = null;
    }

    const buildUpdateData = () => ({
      title: body.title,
      description: body.description,
      // ✅ يقبل 0 (عقار مجاني) — الفرق بين "لم يُرسل" و"صفر"
      price: toNumUpdate(body.price),
      area: body.area,
      bedrooms: toNumUpdate(body.bedrooms),
      bathrooms: toNumUpdate(body.bathrooms),
      floor: toNullableIntUpdate(body.floor),
      apartmentSize: toNullableIntUpdate(body.apartmentSize),
      type: body.type,
      images: body.images,
      videos: body.videos,
      ownerPhone: body.ownerPhone,
      // رقم واتساب اختياري — فارغ يعني مسح الرقم
      ownerWhatsapp: toNullableTextUpdate(body.ownerWhatsapp),
      mapLink: body.mapLink,
      status: body.status,
      statusChangedAt: statusChangedAtData,
      archivedAt: archivedAtData,
      isFeatured: body.isFeatured,
      isVip: body.isVip,
    });

    // الإصلاح الذاتي للـ schema drift بيتعمل تلقائياً في src/lib/db.ts
    const updatedApartment = await db.apartment.update({ where: { id }, data: buildUpdateData() });

    // Notify all connected clients
    notifyApartmentsChanged('updated', id);

    return NextResponse.json({
      message: "تم تحديث العقار بنجاح",
      apartment: updatedApartment,
    });
  } catch (error) {
    console.error("Update apartment error:", error);
    const err = error as { code?: string; message?: string };
    const msg = String(err?.message || '');
    if (err?.code === 'P2022' || err?.code === 'P2021' || msg.includes('does not exist in the current database') || msg.includes('Unknown argument')) {
      return NextResponse.json(
        { error: "قاعدة البيانات ناقصة أعمدة — افتح لوحة المطور → الإعدادات → اضغط (فحص ومزامنة قاعدة البيانات)" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "حدث خطأ أثناء تحديث العقار" },
      { status: 500 }
    );
  }
}

// PATCH - الموافقة/التمييز/الرفض
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== "DEVELOPER") {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, isFeatured } = body;

    const apartment = await db.apartment.findUnique({
      where: { id },
    });

    if (!apartment) {
      return NextResponse.json({ error: "العقار غير موجود" }, { status: 404 });
    }

    let updateData: any = {};

    if (action === "approve") {
      updateData.status = "available";
    } else if (action === "reject") {
      updateData.status = "rejected";
    } else if (action === "feature") {
      updateData.isFeatured = isFeatured !== undefined ? isFeatured : true;
    } else {
      if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
    }

    const updatedApartment = await db.apartment.update({
      where: { id },
      data: updateData,
    });

    // Notify all connected clients
    notifyApartmentsChanged('approved', id);

    // Send email notification to apartment owner
    if (apartment.createdBy) {
      const owner = await db.user.findUnique({ where: { id: apartment.createdBy }, select: { name: true, email: true } });
      if (owner?.email && process.env.RESEND_API_KEY) {
        if (action === 'approve') {
          sendApartmentApprovedEmail({ to: owner.email, name: owner.name, apartmentTitle: apartment.title, apartmentType: apartment.type, price: apartment.price, area: apartment.area });
        } else if (action === 'reject') {
          sendApartmentRejectedEmail({ to: owner.email, name: owner.name, apartmentTitle: apartment.title });
        }
      }
    }

    return NextResponse.json({
      message: "تم تحديث العقار بنجاح",
      apartment: updatedApartment,
    });
  } catch (error) {
    console.error("Patch apartment error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء تحديث العقار" },
      { status: 500 }
    );
  }
}

// DELETE - حذف عقار
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });
    }

    const { id } = await params;

    const apartment = await db.apartment.findUnique({
      where: { id },
    });

    if (!apartment) {
      return NextResponse.json({ error: "العقار غير موجود" }, { status: 404 });
    }

    if (apartment.createdBy !== user.id && user.role !== "DEVELOPER") {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
    }

    await db.apartment.delete({
      where: { id },
    });

    // Notify all connected clients
    notifyApartmentsChanged('deleted', id);

    return NextResponse.json({ message: "تم حذف العقار بنجاح" });
  } catch (error) {
    console.error("Delete apartment error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء حذف العقار" },
      { status: 500 }
    );
  }
}