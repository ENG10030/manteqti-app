/* ============================================================
   التحقق من توقيع ويب هوك Resend (نظام Svix الرسمي)
   Resend بيبعت الهيدرات: svix-id / svix-timestamp / svix-signature
   والتوقيع = base64(HMAC-SHA256(secretBytes, `${id}.${timestamp}.${body}`))
   - لو RESEND_WEBHOOK_SECRET غير مضبوط: نسمح (نفس السلوك القديم — ما نكسرش إنتاج)
   - لو مضبوط: التوقيع إجباري وصالح خلال 5 دقائق (يمنع إعادة اللعب)
   ============================================================ */

const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

export async function verifyResendWebhook(
  request: Request,
  rawBody: string
): Promise<{ ok: boolean; reason?: string }> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return { ok: true, reason: 'no-secret-configured' };

  const id = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signatureHeader = request.headers.get('svix-signature');
  if (!id || !timestamp || !signatureHeader) {
    return { ok: false, reason: 'missing-svix-headers' };
  }

  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'bad-timestamp' };
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > TIMESTAMP_TOLERANCE_SECONDS) {
    return { ok: false, reason: 'timestamp-out-of-tolerance' };
  }

  try {
    const crypto = await import('crypto');
    const secretBytes = secret.startsWith('whsec_')
      ? Buffer.from(secret.slice('whsec_'.length), 'base64')
      : Buffer.from(secret, 'utf8');
    const signedContent = `${id}.${timestamp}.${rawBody}`;
    const expected = crypto
      .createHmac('sha256', secretBytes)
      .update(signedContent)
      .digest('base64');

    // الصيغة: "v1,<sig> v1,<sig> ..." — نقبل أي إصدار v1 مطابق
    const candidates = signatureHeader
      .split(' ')
      .map(v => v.trim())
      .filter(Boolean);
    const valid = candidates.some(entry => {
      const [version, sig] = entry.split(',');
      if (version !== 'v1' || !sig) return false;
      try {
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        return a.length === b.length && crypto.timingSafeEqual(a, b);
      } catch {
        return false;
      }
    });
    return valid ? { ok: true } : { ok: false, reason: 'bad-signature' };
  } catch {
    return { ok: false, reason: 'verification-error' };
  }
}
