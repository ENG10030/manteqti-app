/**
 * ⛔ SECURITY: مقارنة PIN بتوقيت آمن — تمنع timing attacks على رمز أمان المحفظة
 * (كانت مقارنة نصية مباشرة === بتسرب معلومات تدرّجية عن الباحث الصحيح)
 *
 * الطريقة: SHA-256 للطرفين ثم timingSafeEqual — الطول ثابت دايماً فمفيش تسريب طول،
 * والوقت ثابت ميت الاعتماد على تطابق البايتات.
 */

import { createHash, timingSafeEqual } from "crypto";

export function timingSafePinCompare(provided: string, stored: string): boolean {
  try {
    if (typeof provided !== "string" || typeof stored !== "string") return false;
    if (!provided || !stored) return false;
    const a = createHash("sha256").update(provided, "utf8").digest();
    const b = createHash("sha256").update(stored, "utf8").digest();
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
