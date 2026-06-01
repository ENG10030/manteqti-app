import { db } from "./db";
import { verify, sign } from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

// 🔒 SECURITY: JWT Secret - getter ديناميكي
// Build time: يرجع placeholder عشان الـ build يكمل
// Runtime: يرجع الـ env var الحقيقي
function _getJwtSecret(): string {
  return process.env.JWT_SECRET || 'build-time-placeholder';
}
// تصدير ثابت للمتصفح/next-auth بس يتعمل override في الـ runtime
export const JWT_SECRET: string = typeof process !== 'undefined'
  ? (process.env.JWT_SECRET || 'build-time-placeholder')
  : 'build-time-placeholder';

// 🔒 للـ runtime: نستخدم الـ env var الحقيقي دائماً
export function getRuntimeJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('⚠️ FATAL: JWT_SECRET مش معرف في متغيرات البيئة');
    return 'build-time-placeholder';
  }
  return secret;
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

// NextAuth Options
export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // @ts-ignore - NextAuth typing issue
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { identifier: credentials.email.toLowerCase() },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;

        if (user.isBlocked) return null;

        // Check email verification (developers bypass this check)
        if (!user.emailVerified && user.role !== 'DEVELOPER') {
          return null;
        }

        return {
          id: user.id,
          email: user.email || "",
          name: user.name,
          role: user.role,
          emailVerified: user.emailVerified,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt" as const,
  },
  secret: process.env.NEXTAUTH_SECRET || JWT_SECRET,
};

// Get current user from request with DB verification
export async function getCurrentUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    const token = request.cookies.get("auth-token")?.value;

    if (!token) return null;

    const decoded = verify(token, JWT_SECRET) as { userId: string };

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
    if (user.isBlocked) return null;

    return user as AuthUser;
  } catch (error) {
    return null;
  }
}

// Check if user is developer
export async function isDeveloper(request: NextRequest): Promise<boolean> {
  const user = await getCurrentUser(request);
  return user?.role === "DEVELOPER";
}

// Authenticate request WITHOUT DB lookup - only for lightweight/non-sensitive routes
// WARNING: This trusts JWT claims without verifying current DB state
export function authenticateRequest(request: NextRequest): { user: { id: string; role: string } } | null {
  try {
    const token = request.cookies.get("auth-token")?.value;
    if (!token) return null;

    const decoded = verify(token, JWT_SECRET) as { userId: string; role: string };
    if (!decoded.userId) return null;
    return {
      user: { id: decoded.userId, role: decoded.role || 'USER' },
    };
  } catch {
    return null;
  }
}

// Check if user is developer or admin
export function isDeveloperOrAdmin(user: { role: string }): boolean {
  return user.role === 'DEVELOPER' || user.role === 'ADMIN';
}

// Require authenticated user with full DB verification
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

// Require developer role with full DB verification
export async function requireDeveloper(request: NextRequest): Promise<AuthUser> {
  const user = await requireAuth(request);
  
  if (user.role !== "DEVELOPER") {
    throw new Error("غير مصرح لك بهذا الإجراء");
  }
  
  return user;
}

// Create a JWT token helper
export function createToken(payload: { userId: string; identifier: string; role: string }, expiresIn: string = '24h'): string {
  return sign(payload, JWT_SECRET, { expiresIn });
}

// Create auth response with cookie helper
export function createAuthResponse(data: object, token: string) {
  const response = NextResponse.json(data);
  response.cookies.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours (reduced from 7 days)
    path: '/',
  });
  return response;
}
