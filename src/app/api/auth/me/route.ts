import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
    const token = cookies.get("auth-token");

    if (!token) {
      return NextResponse.json({ user: null }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const decoded = verify(token, JWT_SECRET!) as unknown as { userId: string };

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
        walletBalance: true, // إصلاح v7: كان ناقص — فرصيد المحفظة كان بيظهر صفر دايماً
        createdAt: true,
        _count: {
          select: { apartments: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ user: null }, { headers: { 'Cache-Control': 'no-store' } });
    }

    // Return null for blocked users (security)
    if (user.isBlocked) {
      return NextResponse.json({ user: null }, { headers: { 'Cache-Control': 'no-store' } });
    }

    return NextResponse.json({ user }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ user: null }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
