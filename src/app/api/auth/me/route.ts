import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { verify } from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const noCacheHeaders = { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" };

  try {
    const token = request.cookies.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ user: null }, { headers: noCacheHeaders });
    }

    // ✅ Decode JWT directly — NO DATABASE NEEDED
    // This is bulletproof: works even if DB is down, cold start is slow, or schema doesn't match
    const decoded = verify(token, JWT_SECRET) as unknown as {
      userId: string;
      identifier?: string;
      role?: string;
      name?: string;
      email?: string;
      isApproved?: boolean;
      emailVerified?: boolean;
      isBlocked?: boolean;
    };

    // If user is blocked, treat as not logged in
    if (decoded.isBlocked) {
      return NextResponse.json({ user: null }, { headers: noCacheHeaders });
    }

    const user = {
      id: decoded.userId,
      identifier: decoded.identifier || "",
      name: decoded.name || "",
      email: decoded.email || null,
      role: decoded.role || "USER",
      isApproved: decoded.isApproved !== false,
      emailVerified: decoded.emailVerified === true,
      isBlocked: false,
      phone: null,
      createdAt: null,
      _count: null,
    };

    return NextResponse.json({ user }, { headers: noCacheHeaders });
  } catch (error) {
    console.error("[/api/auth/me] Token error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ user: null }, { headers: noCacheHeaders });
  }
}
