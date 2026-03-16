import crypto from 'crypto';

// ✅ مفتاح التشفير (يجب تغييره في الإنتاج)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'manteqti-secret-key-32-characters!!';

// ✅ تشفير النص
export function encrypt(text: string): string {
  try {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch {
    return text;
  }
}

// ✅ فك التشفير
export function decrypt(encryptedData: string): string {
  try {
    const [ivHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return encryptedData;
  }
}

// ✅ تشفير كلمة المرور (باستخدام bcrypt)
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(password, 12);
}

// ✅ التحقق من كلمة المرور
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const bcrypt = await import('bcryptjs');
    return bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

// ✅ توليد Token آمن
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

// ✅ التحقق من صحة البريد الإلكتروني
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

// ✅ التحقق من صحة رقم الهاتف المصري
export function isValidEgyptianPhone(phone: string): boolean {
  // يقبل الأرقام المصرية: 01xxxxxxxxx, +20xxxxxxxxxx, 20xxxxxxxxx
  const phoneRegex = /^(\+20|20|0)?(10|11|12|15)\d{8}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

// ✅ تنظيف النص من الأكواد الضارة (XSS)
export function sanitizeText(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#96;');
}

// ✅ التحقق من قوة كلمة المرور
export function checkPasswordStrength(password: string): {
  score: number;
  feedback: string[];
  isStrong: boolean;
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score += 1;
  else feedback.push('يجب أن تكون 8 أحرف على الأقل');

  if (password.length >= 12) score += 1;

  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('أضف أحرف صغيرة');

  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('أضف أحرف كبيرة');

  if (/[0-9]/.test(password)) score += 1;
  else feedback.push('أضف أرقام');

  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  else feedback.push('أضف رموز خاصة');

  return {
    score,
    feedback,
    isStrong: score >= 4
  };
}

// ✅ توليد OTP آمن
export function generateOTP(length: number = 6): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, digits.length);
    otp += digits[randomIndex];
  }
  return otp;
}

// ✅ التحقق من أن الطلب آمن (HTTPS)
export function isSecureRequest(request: Request): boolean {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const protocol = forwardedProto || (request as any).protocol;
  return protocol === 'https';
}

// ✅ استخراج IP الحقيقي
export function getRealIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  return 'unknown';
}

// ✅ التحقق من أن النطاق مسموح به (للـ CORS)
export function isAllowedOrigin(origin: string, allowedOrigins: string[]): boolean {
  try {
    const originUrl = new URL(origin);
    return allowedOrigins.some(allowed => {
      if (allowed === '*') return true;
      try {
        const allowedUrl = new URL(allowed);
        return originUrl.origin === allowedUrl.origin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

// ✅ تسجيل محاولات تسجيل الدخول الفاشلة
const failedLoginAttempts = new Map<string, { count: number; lockedUntil: number }>();

export function recordFailedLogin(identifier: string): void {
  const existing = failedLoginAttempts.get(identifier);
  const now = Date.now();
  
  if (existing) {
    if (existing.lockedUntil > now) return;
    
    if (existing.count >= 4) {
      // قفل الحساب لمدة 15 دقيقة بعد 5 محاولات فاشلة
      failedLoginAttempts.set(identifier, {
        count: existing.count + 1,
        lockedUntil: now + 15 * 60 * 1000
      });
    } else {
      failedLoginAttempts.set(identifier, {
        count: existing.count + 1,
        lockedUntil: 0
      });
    }
  } else {
    failedLoginAttempts.set(identifier, { count: 1, lockedUntil: 0 });
  }
}

export function isAccountLocked(identifier: string): boolean {
  const attempt = failedLoginAttempts.get(identifier);
  if (!attempt) return false;
  
  if (attempt.lockedUntil > Date.now()) {
    return true;
  }
  
  // إعادة تعيين بعد انتهاء فترة القفل
  if (attempt.lockedUntil > 0 && attempt.lockedUntil <= Date.now()) {
    failedLoginAttempts.delete(identifier);
  }
  
  return false;
}

export function clearFailedLogins(identifier: string): void {
  failedLoginAttempts.delete(identifier);
}

export function getLockTimeRemaining(identifier: string): number {
  const attempt = failedLoginAttempts.get(identifier);
  if (!attempt || !attempt.lockedUntil) return 0;
  
  const remaining = attempt.lockedUntil - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 60000) : 0;
}
