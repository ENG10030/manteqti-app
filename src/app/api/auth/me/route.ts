import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const noCacheHeaders = { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" };

  try {
    // Use NextRequest's built-in cookie parsing (not manual URLSearchParams)
    const token = request.cookies.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ user: null }, { headers: noCacheHeaders });
    }

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
      return NextResponse.json({ user: null }, { headers: noCacheHeaders });
    }

    return NextResponse.json({ user }, { headers: noCacheHeaders });
  } catch (error) {
    // Log for debugging but don't expose error details
    console.error("[/api/auth/me] Auth failed:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ user: null }, { headers: noCacheHeaders });
  }
}
