// ============================================================
// مستندات إثبات الملكية — أدوات مشتركة للتحقق والتخزين
// الصور تصل data URL (JPEG مضغوط من العميل) وتُخزَّن في جدول
// OwnershipDocument المنفصل — لا تُرجَع أبداً في القوائم العامة،
// بل تُقدَّم حصراً عبر /api/apartments/[id]/documents (مالك/مطور)
// ============================================================
import { db } from "./db";

const MAX_DOC_CHARS = 3_000_000; // ~2.2MB صورة بعد base64 — العميل يضغط لـ 1600px/JPEG
const DOC_PREFIX_RE = /^data:image\/(jpeg|jpg|png|webp);base64,/i;

/** يتحقق من صحة data URL للصورة ويرجعها أو null — يمنع أي محتوى غير صورة */
export function sanitizeDocImage(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (!s || s.length > MAX_DOC_CHARS) return null;
  if (!DOC_PREFIX_RE.test(s)) return null;
  return s;
}

interface DocsInput {
  contractImage?: string | null;
  ownerIdCardImage?: string | null;
}

/**
 * يحفظ مستندات الملكية لعقار (ينشئ أو يحدّث).
 * دلالات كل حقل: undefined = لم يُرسل (يُحافظ على القديم) | null = مسح | string صالح = استبدال
 * يُستدعى بعد create/update للعقار مباشرة.
 */
export async function saveOwnershipDocuments(apartmentId: string, docs: DocsInput) {
  const keys = Object.keys(docs) as (keyof DocsInput)[];
  if (keys.length === 0) return null;

  const existing = await db.ownershipDocument.findUnique({ where: { apartmentId } });

  const contractImage = "contractImage" in docs ? sanitizeDocImage(docs.contractImage) : undefined;
  const ownerIdCardImage = "ownerIdCardImage" in docs ? sanitizeDocImage(docs.ownerIdCardImage) : undefined;

  // لا يوجد سجل قديم ولا قيم صالحة جديدة → لا ننشئ سجل فارغ
  if (!existing && contractImage === null && ownerIdCardImage === null) return null;

  if (existing) {
    return db.ownershipDocument.update({
      where: { apartmentId },
      data: {
        ...(contractImage !== undefined ? { contractImage, hasContract: !!contractImage } : {}),
        ...(ownerIdCardImage !== undefined ? { ownerIdCardImage, hasIdCard: !!ownerIdCardImage } : {}),
      },
    });
  }
  return db.ownershipDocument.create({
    data: {
      apartmentId,
      contractImage: contractImage ?? null,
      ownerIdCardImage: ownerIdCardImage ?? null,
      hasContract: !!contractImage,
      hasIdCard: !!ownerIdCardImage,
    },
  });
}

/** هل هناك أي مستندات مرفوعة لعقار؟ */
export async function apartmentHasDocs(apartmentId: string): Promise<boolean> {
  const doc = await db.ownershipDocument.findUnique({
    where: { apartmentId },
    select: { hasContract: true, hasIdCard: true },
  });
  return !!(doc?.hasContract || doc?.hasIdCard);
}
