import { db } from "./db";
import { verify } from "jsonwebtoken";
import { NextRequest } from "next/server";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "USER" | "DEVELOPER";
  isApproved: boolean;
  isBlocked: boolean;
}

// NextAuth Options
export const authOptions: NextAuthOptions = {
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
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET || JWT_SECRET,
};

// الحصول على المستخدم الحالي من الطلب
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

// التحقق من تسجيل الدخول
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

// التحقق من صلاحيات المطور
export async function requireDeveloper(request: NextRequest): Promise<AuthUser> {
  const user = await requireAuth(request);
  
  if (user.role !== "DEVELOPER") {
    throw new Error("غير مصرح لك بهذا الإجراء");
  }
  
  return user;
}
