import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";
const DEVELOPER_EMAIL = (process.env.DEVELOPER_EMAIL || "ahmadmamdouh10030@gmail.com").toLowerCase();

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
    const token = cookies.get("auth-token");

    if (!token) {
      return NextResponse.json({ user: null });
    }

    let decoded: { userId: string };
    try {
      decoded = verify(token, JWT_SECRET) as { userId: string };
    } catch {
      const response = NextResponse.json({ user: null, tokenExpired: true });
      response.cookies.set("auth-token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      });
      return response;
    }

    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isApproved: true,
        isBlocked: true,
        identifier: true,
        emailVerified: true,
        createdAt: true,
        _count: {
          select: { apartments: true },
        },
      },
    });

    if (!user) {
      const response = NextResponse.json({ user: null, userDeleted: true });
      response.cookies.set("auth-token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      });
      return response;
    }

    // ╔═══════════════════════════════════════════════════════════╗
    // ║  المطور لا يمكن حظره أبداً                                ║
    // ║  إذا identifier أو role = مطور = إلغاء أي حظر            ║
    // ╚═══════════════════════════════════════════════════════════╝
    const isDeveloperAccount = user.identifier === DEVELOPER_EMAIL || user.role === "DEVELOPER";
    
    if (isDeveloperAccount) {
      if (user.isBlocked || !user.isApproved || user.role !== "DEVELOPER") {
        try {
          await db.user.update({
            where: { id: user.id },
            data: {
              isBlocked: false,
              blockedAt: null,
              blockReason: null,
              isApproved: true,
              role: "DEVELOPER",
              emailVerified: true,
            },
          });
        } catch (updateError) {
          console.error("Failed to fix developer account:", updateError);
        }
        return NextResponse.json({
          user: {
            ...user,
            isBlocked: false,
            isApproved: true,
            role: "DEVELOPER",
          },
        });
      }
      return NextResponse.json({ user });
    }

    // ╔═══════════════════════════════════════════════════════════╗
    // ║  مستخدم عادي محظور = مسح الكوكى                           ║
    // ╚═══════════════════════════════════════════════════════════╝
    if (user.isBlocked) {
      const response = NextResponse.json({ user: null, userBlocked: true });
      response.cookies.set("auth-token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      });
      return response;
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ user: null });
  }
}
