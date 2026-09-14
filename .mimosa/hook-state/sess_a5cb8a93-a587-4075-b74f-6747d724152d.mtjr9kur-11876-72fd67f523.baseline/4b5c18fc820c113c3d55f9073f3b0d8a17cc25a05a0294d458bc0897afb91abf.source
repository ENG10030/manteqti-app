import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Simple health check - no database info exposed
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      status: "error",
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}