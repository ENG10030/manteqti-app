import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";
import { notifyApartmentsChanged } from "@/lib/realtime";
import { sendApartmentApprovedEmail, sendApartmentRejectedEmail } from "@/lib/email";
import { saveOwnershipDocuments, sanitizeDocImage } from "@/lib/ownership-docs";
import { buildInstallmentsUpdate } from "@/lib/installments";

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

// لحقول Int القابلة لـ null (apartmentSize) — فارغ أو غير صالح → null (مسح القيمة)
function toNullableIntUpdate(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = typeof v === 'number' ? Math.trunc(v) : parseInt(String(v), 10);
  return isNaN(n) ? null : n;
}

// v10.7: للدور النص الحر — "أرضي"، "الأساسي"، "الدور السادس" أو أي رقم — فارغ → null (مسح القيمة)
// بيقبل بيانات قديمة رقمية كمان (number → نص) وبيطبق تعقيم وحد 30 حرف
function toFloorUpdate(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);
  return s || null;
}

// لحقول نصية قابلة لـ null (ownerWhatsapp) — فارغ → null (مسح الرقم)
function toNullableTextUpdate(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).replace(/<[^>]*>/g, '').trim().slice(0, 30);
  return s || null;
}

// تعقيم نص (إزالة وسوم HTML + حد طول) — نفس نهج POST
function sanitizeText(v: unknown, max = 500): string {
  return String(v ?? '').replace(/<[^>]*>/g, '').trim().slice(0, max);
}

// ⛔ SECURITY: رابط الخريطة لازم يكون http/https صالح — يمنع javascript: وغيرها (XSS مخزّن)
function safeMapLink(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim().slice(0, 500);
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return s;
  } catch {
    return null;
  }
}

// الصور/الفيديوهات JSON نصي بحد أقصى — يمنع تضخيم القاعدة
function safeMediaList(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v);
  if (!s || s.length > 100_000) return null; // حد 100KB للنص JSON
  return s;
}

const APARTMENT_TYPES = ['rent', 'sale'];
const APARTMENT_STATUSES = ['available', 'pending', 'sold', 'rented', 'unavailable', 'rejected'];

// بوابة التعديل المشتركة: مطور يمرر دائماً، مالك لازم يكون مؤكد البريد ومعتمد وغير محظور
function canEditApartment(user: { role: string; isBlocked: boolean; emailVerified: boolean; isApproved: boolean }): boolean {
  if (user.role === 'DEVELOPER') return true;
  if (user.isBlocked) return false;
  if (!user.emailVerified) return false;
  if (!user.isApproved) return false;
  return true;
}

// GET - جلب عقار واحد
// ⛔ SECURITY: بيانات التواصل (هاتف المالك/واتساب/الخريطة/بريد وهاتف صاحب الحساب)
// تظهر للمالك والمطور فقط — أقل من كده يستلم نسخة معقمة (نفس بوابات /details)
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

    const viewer = await getCurrentUser(request);
    const isPrivileged = !!viewer && (viewer.role === 'DEVELOPER' || viewer.id === apartment.createdBy);

    if (isPrivileged) {
      return NextResponse.json({ apartment });
    }

    const { ownerPhone, ownerWhatsapp, mapLink, ...safeApartment } = apartment;
    const sanitized = {
      ...safeApartment,
      ownerPhone: null,
      ownerWhatsapp: null,
      mapLink: null,
      user: apartment.user ? { id: apartment.user.id, name: apartment.user.name } : null,
    };
    return NextResponse.json({ apartment: sanitized });
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

    if (!canEditApartment(user)) {
      return NextResponse.json(
        { error: user.isBlocked ? "تم حظر حسابك — لا يمكنك تعديل العقارات" : "حسابك غير مؤكد أو قيد المراجعة" },
        { status: 403 }
      );
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

    // ⛔ SECURITY: نفس تعقيم POST — النصوص بدون وسوم، السالب مرفوض، التعداد مقيّد
    if (body.title !== undefined && !sanitizeText(body.title)) {
      return NextResponse.json({ error: "العنوان مطلوب" }, { status: 400 });
    }
    if (body.price !== undefined) {
      const p = toNumUpdate(body.price);
      if (p === undefined || p < 0) {
        return NextResponse.json({ error: "السعر غير صالح" }, { status: 400 });
      }
    }
    if (body.type !== undefined && !APARTMENT_TYPES.includes(String(body.type))) {
      return NextResponse.json({ error: "نوع العقار غير صالح" }, { status: 400 });
    }
    if (body.status !== undefined && !APARTMENT_STATUSES.includes(String(body.status))) {
      return NextResponse.json({ error: "الحالة غير صالحة" }, { status: 400 });
    }
    body.mapLink = body.mapLink === undefined ? undefined : safeMapLink(body.mapLink);

    // v10.6: حدود منطقية للغرف/الحمامات/الدور عند التعديل (الإدخال بقى يدوياً — والسيرفر بيرد برسالة عربية واضحة)
    if (body.bedrooms !== undefined) {
      const n = toNumUpdate(body.bedrooms);
      if (n === undefined || !Number.isInteger(n) || n < 0 || n > 20) {
        return NextResponse.json({ error: "عدد غرف النوم غير صالح (رقم صحيح من 0 لـ 20)" }, { status: 400 });
      }
    }
    if (body.bathrooms !== undefined) {
      const n = toNumUpdate(body.bathrooms);
      if (n === undefined || !Number.isInteger(n) || n < 0 || n > 10) {
        return NextResponse.json({ error: "عدد الحمامات غير صالح (رقم صحيح من 0 لـ 10)" }, { status: 400 });
      }
    }
    if (body.floor !== undefined && body.floor !== null && String(body.floor).trim() !== "") {
      const f = toFloorUpdate(body.floor);
      if (f && !/^[0-9\u0600-\u06FFa-zA-Z\s\/\-_.+]+$/.test(f)) {
        return NextResponse.json({ error: "الدور لازم يكون حروف أو أرقام فقط (مثال: أرضي، الدور السادس، 5)" }, { status: 400 });
      }
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

    // نظام الأقساط — "لم يُرسل" = تجاهل، false = مسح، true = حفظ القيم المعقّمة
    const installmentsUpdate = buildInstallmentsUpdate(body);

    const buildUpdateData = () => ({
      title: body.title !== undefined ? sanitizeText(body.title) : undefined,
      description: body.description !== undefined ? sanitizeText(body.description) : undefined,
      // ✅ يقبل 0 (عقار مجاني) — الفرق بين "لم يُرسل" و"صفر"
      price: toNumUpdate(body.price),
      area: body.area !== undefined ? sanitizeText(body.area, 120) : undefined,
      bedrooms: toNumUpdate(body.bedrooms),
      bathrooms: toNumUpdate(body.bathrooms),
      floor: toFloorUpdate(body.floor),
      apartmentSize: toNullableIntUpdate(body.apartmentSize),
      type: body.type,
      images: safeMediaList(body.images),
      videos: safeMediaList(body.videos),
      ownerPhone: body.ownerPhone !== undefined ? sanitizeText(body.ownerPhone, 30) : undefined,
      // رقم واتساب اختياري — فارغ يعني مسح الرقم
      ownerWhatsapp: toNullableTextUpdate(body.ownerWhatsapp),
      mapLink: body.mapLink,
      status: body.status,
      statusChangedAt: statusChangedAtData,
      archivedAt: archivedAtData,
      // نظام الأقساط — نفس منهج "لم يُرسل = تجاهل"
      ...installmentsUpdate,
      isFeatured: body.isFeatured,
      isVip: body.isVip,
    });

    // الإصلاح الذاتي للـ schema drift بيتعمل تلقائياً في src/lib/db.ts
    const updatedApartment = await db.apartment.update({ where: { id }, data: buildUpdateData() });

    // مستندات الملكية — للمالك أو المطور: استبدال أو مسح (null) أو تجاهل (غير مُرسل)
    if (body.ownershipContractImage !== undefined || body.ownerIdCardImage !== undefined) {
      try {
        await saveOwnershipDocuments(id, {
          ...(body.ownershipContractImage !== undefined ? { contractImage: sanitizeDocImage(body.ownershipContractImage) } : {}),
          ...(body.ownerIdCardImage !== undefined ? { ownerIdCardImage: sanitizeDocImage(body.ownerIdCardImage) } : {}),
        });
      } catch (docErr) {
        console.error("Ownership docs update error:", docErr);
      }
    }

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
    } else if (action === "verify-ownership" || action === "unverify-ownership") {
      // توثيق الملكية بعد فحص المستندات — للمطور فقط (الوصول هنا مقيّد به أصلاً)
      const wantVerified = action === "verify-ownership";
      const doc = await db.ownershipDocument.findUnique({
        where: { apartmentId: id },
        select: { hasContract: true, hasIdCard: true },
      });
      if (wantVerified && !(doc?.hasContract || doc?.hasIdCard)) {
        return NextResponse.json({ error: "لا توجد مستندات مرفوعة لهذا العقار بعد" }, { status: 400 });
      }
      await db.ownershipDocument.upsert({
        where: { apartmentId: id },
        update: {
          verified: wantVerified,
          verifiedBy: wantVerified ? user.id : null,
          verifiedAt: wantVerified ? new Date() : null,
        },
        create: {
          apartmentId: id,
          verified: wantVerified,
          verifiedBy: wantVerified ? user.id : null,
          verifiedAt: wantVerified ? new Date() : null,
        },
      });
      const fresh = await db.apartment.findUnique({ where: { id } });
      return NextResponse.json({ message: wantVerified ? "تم توثيق ملكية العقار" : "تم إلغاء توثيق الملكية", apartment: fresh });
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

    // ⛔ SECURITY: نفس بوابة التعديل — المحظور/غير الموثق/غير المعتمد ما يقدرش يمسح
    // (كان DELETE بلا بوابة بينما PUT عليها — محظور كان يمسح عقاراته ويتهرب من الردع)
    if (!canEditApartment(user)) {
      return NextResponse.json({ error: "حسابك غير مصرح له بالحذف — راجع الإدارة" }, { status: 403 });
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