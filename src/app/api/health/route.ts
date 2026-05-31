import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Test database connection with a simple query
    const start = Date.now();
    const apartmentCount = await db.apartment.count();
    const userCount = await db.user.count();
    const settingsCount = await db.settings.count();
    const latency = Date.now() - start;

    return NextResponse.json({
      status: "ok",
      database: "connected",
      latency: `${latency}ms`,
      apartments: apartmentCount,
      users: userCount,
      settings: settingsCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    // Return detailed error for debugging
    const dbUrl = process.env.DATABASE_URL || "";
    const safeUrl = dbUrl.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
    
    return NextResponse.json({
      status: "error",
      database: "disconnected",
      error: "Database connection failed",
      errorMessage: error?.message || String(error),
      errorCode: error?.code || "UNKNOWN",
      dbUrlPreview: safeUrl ? `${safeUrl.substring(0, 80)}...` : "NOT SET",
      hasSslMode: dbUrl.includes("sslmode="),
      hasPgbouncer: dbUrl.includes("pgbouncer=true"),
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
