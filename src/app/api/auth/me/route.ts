import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
    const token = cookies.get("auth-token");

    if (!token) {
      return NextResponse.json(
        { user: null },
        { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" } }
      );
    }

    // Log token verification attempt for debugging
    const decoded = verify(token, JWT_SECRET) as { userId: string; identifier?: string; role?: string };

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
      return NextResponse.json(
        { user: null },
        { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" } }
      );
    }

    return NextResponse.json(
      { user },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" } }
    );
  } catch (error) {
    console.error("[/api/auth/me] Token verification failed:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { user: null },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" } }
    );
  }
}
