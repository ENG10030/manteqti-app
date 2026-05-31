import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Test database connection — no data leakage
    await db.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    // 🔒 SECURITY: Never expose error details in production response
    console.error("Health check failed:", error);
    return NextResponse.json({
      status: "error",
      database: "disconnected",
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
