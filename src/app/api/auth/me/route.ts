import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";

// CRITICAL: Get secret securely
function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("JWT_SECRET not set");
  return s || "manteqti-dev-only-secret";
}

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
    const token = cookies.get("auth-token");

    if (!token) {
      return NextResponse.json({ user: null });
    }

    // CRITICAL: Always specify algorithms
    const decoded = verify(token, getSecret(), { algorithms: ["HS256"] }) as { userId: string };
    if (!decoded.userId) {
      return NextResponse.json({ user: null });
    }

    // CRITICAL FIX: Fetch FRESH data from DB — don't trust stale JWT
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
      return NextResponse.json({ user: null });
    }

    // CRITICAL FIX: If user is blocked, return null — force re-login
    if (user.isBlocked) {
      return NextResponse.json({ user: null, blocked: true });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ user: null });
  }
}
