import { db } from "./db";
import { verify } from "jsonwebtoken";
import { NextRequest } from "next/server";

// 🔐 JWT_SECRET — fail fast if missing
export const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set!");
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isApproved: boolean;
  isBlocked: boolean;
  emailVerified: boolean;
}

// الحصول على المستخدم الحالي من الطلب
export async function getCurrentUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    const token = request.cookies.get("auth-token")?.value;

    if (!token) return null;

    const decoded = verify(token, JWT_SECRET) as unknown as { userId: string };

    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isApproved: true,
        isBlocked: true,
        emailVerified: true,
      },
    });

    if (!user) return null;

    return user as AuthUser;
  } catch (error) {
    return null;
  }
}

// التحقق من صلاحيات المطور
export async function isDeveloper(request: NextRequest): Promise<boolean> {
  const user = await getCurrentUser(request);
  return user?.role === "DEVELOPER";
}

// التحقق من تسجيل الدخول (بدون DB - للـ routes الخفيفة)
export function authenticateRequest(request: NextRequest): { user: { id: string; role: string } } | null {
  try {
    const token = request.cookies.get("auth-token")?.value;
    if (!token) return null;

    const decoded = verify(token, JWT_SECRET) as unknown as { userId: string; role: string };
    if (!decoded.userId) return null;
    return {
      user: { id: decoded.userId, role: decoded.role || 'USER' },
    };
  } catch {
    return null;
  }
}

// التحقق من أن المستخدم مطور أو أدمن
export function isDeveloperOrAdmin(user: { role: string }): boolean {
  return user.role === 'DEVELOPER' || user.role === 'ADMIN';
}

// التحقق من تسجيل الدخول
export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  const user = await getCurrentUser(request);

  if (!user) {
    throw new Error("يجب تسجيل الدخول");
  }

  if (user.isBlocked) {
    throw new Error("تم حظر حسابك");
  }

  // Check email verification (developers bypass this check)
  if (!user.emailVerified && user.role !== 'DEVELOPER') {
    throw new Error("يجب تأكيد البريد الإلكتروني أولاً");
  }

  return user;
}

// التحقق من صلاحيات المطور
export async function requireDeveloper(request: NextRequest): Promise<AuthUser> {
  const user = await requireAuth(request);

  if (user.role !== "DEVELOPER") {
    throw new Error("غير مصرح لك بهذا الإجراء");
  }

  return user;
}
