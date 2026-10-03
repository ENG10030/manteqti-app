import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isValidId } from "@/lib/auth-middleware";

/* ============================================================
   GET /api/images/[id] — تقديم صور/فيديوهات الشقق المرفوعة
   عام (الصور محتوى علني في الموقع) + كاش سنة كاملة (immutable)
   لأن الـ id فريد للملف نفسه ولن يتغير محتواه أبداً
   ⛔ SECURITY: الـ Content-Type بيتشتق من قايمة بيضا فقط — عمرك ما تثق في المخزّن،
   + CSP sandbox على الردود نفسها: أي محتوى نشط حتى لو تسلّل ميعرفش ينفذ شيء
   ============================================================ */

const SERVABLE_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/webm",
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || !isValidId(id)) {
      return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
    }

    const row = await db.uploadedImage.findUnique({
      where: { id },
      select: { data: true, mimeType: true, kind: true },
    });
    if (!row) {
      return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });
    }

    const buffer = Buffer.from(row.data, "base64");
    // ⛔ SECURITY: أي mimeType مش في القايمة البيضا → octet-stream (تنزيل بدل تنفيذ)
    const safeType = SERVABLE_TYPES.has(row.mimeType) ? row.mimeType : "application/octet-stream";
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": safeType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `inline; filename="${row.kind}"`,
        // ⛔ SECURITY: بيئة معزولة — حتى لو محتوى HTML/JS تسلّل بأي شكل ميعرفش يشغّل سكربت أو يقرأ كوكيز
        "Content-Security-Policy": "sandbox; default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; media-src 'none'; frame-ancestors 'none'",
      },
    });
  } catch (error) {
    console.error("serve image error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء تحميل الملف" }, { status: 500 });
  }
}
