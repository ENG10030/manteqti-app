import { createHash, randomBytes, randomInt } from 'crypto';

/**
 * Validate Egyptian phone number
 */
export function isValidEgyptianPhone(phone: string): boolean {
  const egyptianMobileRegex = /^01[0125][0-9]{8}$/;
  return egyptianMobileRegex.test(phone);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength (at least 6 chars with complexity)
 */
export function isStrongPassword(password: string): boolean {
  if (password.length < 6) return false;
  let score = 0;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return score >= 2; // At least 2 character types
}

/**
 * Hash password using bcrypt (secure)
 * @deprecated Use bcryptjs directly instead: import bcrypt from 'bcryptjs'; bcrypt.hash(password, 10)
 */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(password, 10);
}

/**
 * Verify password against hash using bcrypt (secure)
 * @deprecated Use bcryptjs directly instead: import bcrypt from 'bcryptjs'; bcrypt.compare(password, hash)
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(password, hash);
}

/**
 * Generate random token
 */
export function generateToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Generate OTP code
 */
export function generateOTP(): string {
  return randomInt(100000, 999999).toString();
}

/**
 * Sanitize string input
 */
export function sanitizeString(str: string): string {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Validate CUID format
 */
export function isValidId(id: string): boolean {
  const cuidRegex = /^c[a-z0-9]{24}$/;
  const cuid2Regex = /^[a-z0-9]{24,32}$/;
  return cuidRegex.test(id) || cuid2Regex.test(id);
}
