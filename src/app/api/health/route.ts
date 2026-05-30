import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Check for DATABASE_URL
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({
        status: "error",
        database: "no_database_url",
        error: "DATABASE_URL environment variable is not set. Please add it in Vercel → Settings → Environment Variables.",
        hint: "Get it from Supabase Dashboard → Settings → Database → Connection string (Transaction pooler)",
        requiredFormat: "postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true",
        envVarsPresent: {
          DATABASE_URL: !!process.env.DATABASE_URL,
          RESEND_API_KEY: !!process.env.RESEND_API_KEY,
          RESEND_FROM_EMAIL: !!process.env.RESEND_FROM_EMAIL,
          JWT_SECRET: !!process.env.JWT_SECRET,
          DEVELOPER_EMAIL: !!process.env.DEVELOPER_EMAIL,
          CLOUDINARY_CLOUD_NAME: !!process.env.CLOUDINARY_CLOUD_NAME,
        },
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

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
      envVarsPresent: {
        DATABASE_URL: !!process.env.DATABASE_URL,
        RESEND_API_KEY: !!process.env.RESEND_API_KEY,
        RESEND_FROM_EMAIL: !!process.env.RESEND_FROM_EMAIL,
        JWT_SECRET: !!process.env.JWT_SECRET,
        DEVELOPER_EMAIL: !!process.env.DEVELOPER_EMAIL,
        CLOUDINARY_CLOUD_NAME: !!process.env.CLOUDINARY_CLOUD_NAME,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      status: "error",
      database: "disconnected",
      error: error.message || "Unknown error",
      hint: process.env.DATABASE_URL 
        ? "DATABASE_URL is set but connection failed. Check the format and credentials."
        : "DATABASE_URL is not set in environment variables.",
      envVarsPresent: {
        DATABASE_URL: !!process.env.DATABASE_URL,
        RESEND_API_KEY: !!process.env.RESEND_API_KEY,
        RESEND_FROM_EMAIL: !!process.env.RESEND_FROM_EMAIL,
        JWT_SECRET: !!process.env.JWT_SECRET,
        DEVELOPER_EMAIL: !!process.env.DEVELOPER_EMAIL,
        CLOUDINARY_CLOUD_NAME: !!process.env.CLOUDINARY_CLOUD_NAME,
      },
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
