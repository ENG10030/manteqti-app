import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApprovedUser } from "@/lib/auth-middleware";

/* ============================================================
   POST /api/upload — رفع صور/فيديوهات الشقق
   كان المسار مفقوداً من اليوم الأول (file-upload.tsx كان يكلمه بلا جدوى)
   التخزين: base64 في قاعدة البيانات + يُخدم عبر GET /api/images/[id]
   يعمل بدون أي خدمة خارجية (لا Cloudinary ولا S3) — مضبوط لحدود Vercel:
   - الصور تُضغط على جهاز المستخدم قبل الرفع (≤ ~2MB)
   - الفيديو ≤ 3MB (حد body الـ serverless 4.5MB بعد ترميز base64)
   ============================================================ */

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;   // 3MB بعد الضغط
const MAX_VIDEO_BYTES = 3 * 1024 * 1024;   // 3MB (حد body الـ serverless)
const MAX_DATA_FIELD = 5 * 1024 * 1024;    // حد أقصي لطول النص المستلم (base64 ≈ 1.37x)

// حد معدل الرفع في الذاكرة — يمنع التخريب السريع (30 ملف / 10 دقائق لكل مستخدم)
const uploadHits = new Map<string, number[]>();
function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const window = 10 * 60 * 1000;
  const hits = (uploadHits.get(userId) || []).filter(t => now - t < window);
  if (hits.length >= 30) { uploadHits.set(userId, hits); return true; }
  hits.push(now);
  uploadHits.set(userId, hits);
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const { auth, errorResponse } = await requireApprovedUser(request);
    if (errorResponse || !auth) return errorResponse!;
    if (isRateLimited(auth.userId)) {
      return NextResponse.json({ error: "عدد كبير من الرفع — حاول بعد 10 دقائق" }, { status: 429 });
    }

    const contentType = request.headers.get("content-type") || "";
    let data = "";
    let mimeType = "";

    if (contentType.includes("multipart/form-data")) {
      // مسار FormData (متوافق مع file-upload.tsx القديم)
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "لم يتم إرسال ملف" }, { status: 400 });
      }
      mimeType = file.type;
      if (!ALLOWED_IMAGE_TYPES.includes(mimeType) && !ALLOWED_VIDEO_TYPES.includes(mimeType)) {
        return NextResponse.json({ error: "نوع الملف غير مدعوم — الصور: JPEG/PNG/WebP/GIF، الفيديو: MP4/WebM" }, { status: 415 });
      }
      if (file.size > MAX_VIDEO_BYTES) {
        return NextResponse.json({ error: "الملف أكبر من 3MB — الصور تُضغط تلقائياً قبل الرفع" }, { status: 413 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      data = buffer.toString("base64");
    } else {
      // مسار JSON { data: base64, mimeType } (يُستخدم بعد الضغط على العميل)
      const body = await request.json().catch(() => null);
      if (!body || typeof body.data !== "string" || typeof body.mimeType !== "string") {
        return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
      }
      // قبول base64 خام أو data URL كامل — نستبعد البادئة
      const raw = body.data.startsWith("data:") ? body.data.slice(body.data.indexOf(",") + 1) : body.data;
      if (!raw || raw.length > MAX_DATA_FIELD) {
        return NextResponse.json({ error: "الملف أكبر من الحد المسموح (3MB)" }, { status: 413 });
      }
      if (!/^[A-Za-z0-9+/=.\s]+$/.test(raw.slice(0, 128))) {
        return NextResponse.json({ error: "محتوى الملف غير صالح" }, { status: 400 });
      }
      mimeType = body.mimeType;
      data = raw.replace(/\s/g, "");
    }

    const kind = ALLOWED_IMAGE_TYPES.includes(mimeType) ? "image" : "video";
    const size = Math.floor((data.length * 3) / 4); // الحجم التقريبي بعد فك base64
    const maxBytes = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (size > maxBytes) {
      return NextResponse.json({ error: kind === "image" ? "الصورة أكبر من 3MB" : "الفيديو أكبر من 3MB" }, { status: 413 });
    }

    const row = await db.uploadedImage.create({
      data: { data, mimeType, size, kind, uploadedBy: auth.userId },
      select: { id: true },
    });

    return NextResponse.json({ success: true, id: row.id, url: `/api/images/${row.id}` });
  } catch (error) {
    console.error("upload error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء الرفع" }, { status: 500 });
  }
}
