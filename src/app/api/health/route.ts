import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Test database connection
    const apartmentCount = await db.apartment.count();
    const userCount = await db.user.count();
    const settingsCount = await db.settings.count();

    return NextResponse.json({
      status: "ok",
      database: "connected",
      apartments: apartmentCount,
      users: userCount,
      settings: settingsCount,
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
