import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";
import { NextRequest } from "next/server";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

// 🔒 SECURITY: لا يوجد fallback - لكن التحقق مش وقت build (lazy)
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  // إذا مش موجود، نرجع placeholder للـ build time بس
  // الأمان الحقيقي بيكون في الـ runtime لما الـ API يتطلب فعلاً
  if (!secret) return 'build-time-only-placeholder';
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
  secret: process.env.NEXTAUTH_SECRET || JWT_SECRET || "",
};

// 🔒 الحصول على المستخدم الحالي مع التحقق من قاعدة البيانات
export async function getCurrentUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    const token = request.cookies.get("auth-token")?.value;
    if (!token) return null;

    // 🔒 SECURITY: تحقق حقيقي في الـ runtime
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('⚠️ FATAL: JWT_SECRET مش معرف - تسجيل الدخول معطل');
      return null;
    }

    const decoded = verify(token, secret) as { userId: string };
    if (!decoded.userId) return null;

    // 🔒 التحقق من قاعدة البيانات - لا نثق بالـ role من الـ token
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

export async function isDeveloper(request: NextRequest): Promise<boolean> {
  const user = await getCurrentUser(request);
  return user?.role === "DEVELOPER";
}

// 🔒 إلغاء authenticateRequest - يجب استخدام getCurrentUser
// تم إزالته لأنه كان يثق بالـ role من الـ token

export function isDeveloperOrAdmin(user: { role: string }): boolean {
  return user.role === 'DEVELOPER' || user.role === 'ADMIN';
}

export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new Error("يجب تسجيل الدخول");
  }
  if (user.isBlocked) {
    throw new Error("تم حظر حسابك");
  }
  return user;
}

export async function requireDeveloper(request: NextRequest): Promise<AuthUser> {
  const user = await requireAuth(request);
  if (user.role !== "DEVELOPER") {
    throw new Error("غير مصرح لك بهذا الإجراء");
  }
  return user;
}
