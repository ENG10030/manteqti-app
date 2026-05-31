import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { verify } from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const noCacheHeaders = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  };

  try {
    // Debug: log all cookies received
    const allCookies = request.cookies.getAll();
    const token = request.cookies.get("auth-token")?.value;

    if (!token) {
      console.log("[/api/auth/me] No auth-token cookie found. Cookies present:", allCookies.map(c => c.name).join(", ") || "NONE");
      return NextResponse.json({ user: null }, { headers: noCacheHeaders });
    }

    console.log("[/api/auth/me] auth-token cookie found, length:", token.length, ", starts with:", token.substring(0, 20) + "...");

    // ✅ Decode JWT directly — NO DATABASE NEEDED
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
      console.log("[/api/auth/me] User is BLOCKED:", decoded.userId);
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

    console.log("[/api/auth/me] ✓ User authenticated:", user.id, user.name, "role:", user.role);

    return NextResponse.json({ user }, { headers: noCacheHeaders });
  } catch (error) {
    console.error("[/api/auth/me] Token verification error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ user: null }, { headers: noCacheHeaders });
  }
}
