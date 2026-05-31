import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";
import { notifyRealtime } from "@/lib/realtime";

const JWT_SECRET = process.env.JWT_SECRET || "manteqti-secret-key-2024";
const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || "ahmadmamdouh10030@gmail.com";

async function isDeveloper(request: Request): Promise<boolean> {
  const cookieHeader = request.headers.get("cookie");
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
  const token = cookies.get("auth-token");

  if (!token) return false;

  try {
    const decoded = verify(token, JWT_SECRET) as { userId: string; role?: string; identifier?: string };
    
    if (decoded.role === "DEVELOPER" || decoded.identifier === DEVELOPER_EMAIL) return true;

    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true, identifier: true },
    });

    return user?.role === "DEVELOPER" || user?.identifier === DEVELOPER_EMAIL;
  } catch {
    return false;
  }
}

async function getCurrentUserId(request: Request): Promise<string | null> {
  const cookieHeader = request.headers.get("cookie");
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, "&") || "");
  const token = cookies.get("auth-token");

  if (!token) return null;

  try {
    const decoded = verify(token, JWT_SECRET) as { userId: string };
    return decoded.userId;
  } catch {
    return null;
  }
}

// Validate fee value - must be non-negative integer
function validateFee(value: any): number {
  const num = parseInt(value);
  if (isNaN(num) || num < 0) return 0;
  return num;
}

// Validate currency - max 10 chars, no HTML
function validateCurrency(value: any): string {
  if (typeof value !== 'string') return 'ج.م';
  const sanitized = value.replace(/<[^>]*>/g, '').trim().slice(0, 10);
  return sanitized || 'ج.م';
}

const DEFAULT_SETTINGS = {
  contactFee: 50,
  regularFee: 30,
  featuredFee: 100,
  premiumFee: 200,
  vipFee: 300,
  saleDisplayFee: 100,
  rentDisplayFee: 75,
  otherServicesFee: 50,
  highlightFee: 150,
  priorityListingFee: 200,
  verifiedListingFee: 250,
  currency: "ج.م",
};

// ============= AUTO-MIGRATION =============
// Ensures the Settings table exists with ALL required columns.
// The Prisma schema uses @@map("settings") and column @map() directives.
// This handles cases where prisma db:push fails during Vercel build.

let migrationDone = false;

async function ensureSettingsTable(): Promise<boolean> {
  if (migrationDone) return true;

  try {
    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgres = dbUrl.startsWith('postgres') || dbUrl.startsWith('postgresql');

    if (isPostgres) {
      // PostgreSQL: table name is "settings" (lowercase, via @@map)
      // Columns use snake_case (via @map)
      const tableExists = await db.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT FROM pg_tables 
          WHERE tablename = 'settings'
        ) as "exists"
      `;

      if (!tableExists[0]?.exists) {
        // Create table matching schema.postgres.prisma exactly
        await db.$executeRawUnsafe(`
          CREATE TABLE "settings" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "contact_fee" INTEGER NOT NULL DEFAULT 50,
            "featured_fee" INTEGER NOT NULL DEFAULT 100,
            "premium_fee" INTEGER NOT NULL DEFAULT 200,
            "sale_display_fee" INTEGER NOT NULL DEFAULT 100,
            "rent_display_fee" INTEGER NOT NULL DEFAULT 75,
            "other_services_fee" INTEGER NOT NULL DEFAULT 50,
            "highlight_fee" INTEGER NOT NULL DEFAULT 150,
            "priority_listing_fee" INTEGER NOT NULL DEFAULT 200,
            "verified_listing_fee" INTEGER NOT NULL DEFAULT 250,
            "regular_fee" INTEGER NOT NULL DEFAULT 30,
            "vip_fee" INTEGER NOT NULL DEFAULT 300,
            "currency" TEXT NOT NULL DEFAULT 'ج.م',
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('[Settings Migration] Table "settings" created');
      } else {
        // Table exists - add any missing columns
        const existingColumns = await db.$queryRaw<Array<{ column_name: string }>>`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'settings'
        `;
        const colNames = existingColumns.map(c => c.column_name);

        const required: Record<string, string> = {
          "contact_fee": "INTEGER NOT NULL DEFAULT 50",
          "regular_fee": "INTEGER NOT NULL DEFAULT 30",
          "featured_fee": "INTEGER NOT NULL DEFAULT 100",
          "premium_fee": "INTEGER NOT NULL DEFAULT 200",
          "vip_fee": "INTEGER NOT NULL DEFAULT 300",
          "sale_display_fee": "INTEGER NOT NULL DEFAULT 100",
          "rent_display_fee": "INTEGER NOT NULL DEFAULT 75",
          "other_services_fee": "INTEGER NOT NULL DEFAULT 50",
          "highlight_fee": "INTEGER NOT NULL DEFAULT 150",
          "priority_listing_fee": "INTEGER NOT NULL DEFAULT 200",
          "verified_listing_fee": "INTEGER NOT NULL DEFAULT 250",
          "currency": "TEXT NOT NULL DEFAULT 'ج.م'",
        };

        for (const [col, def] of Object.entries(required)) {
          if (!colNames.includes(col)) {
            await db.$executeRawUnsafe(`ALTER TABLE "settings" ADD COLUMN "${col}" ${def}`);
            console.log(`[Settings Migration] Added column: ${col}`);
          }
        }
      }
    } else {
      // SQLite: table name is "Settings" (Prisma default)
      const tableExists = await db.$queryRaw<Array<{ name: string }>>`
        SELECT name FROM sqlite_master WHERE type='table' AND name='Settings'
      `;
      if (!tableExists || tableExists.length === 0) {
        await db.$executeRawUnsafe(`
          CREATE TABLE "Settings" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "contactFee" INTEGER NOT NULL DEFAULT 50,
            "regularFee" INTEGER NOT NULL DEFAULT 30,
            "featuredFee" INTEGER NOT NULL DEFAULT 100,
            "premiumFee" INTEGER NOT NULL DEFAULT 200,
            "vipFee" INTEGER NOT NULL DEFAULT 300,
            "saleDisplayFee" INTEGER NOT NULL DEFAULT 100,
            "rentDisplayFee" INTEGER NOT NULL DEFAULT 75,
            "otherServicesFee" INTEGER NOT NULL DEFAULT 50,
            "highlightFee" INTEGER NOT NULL DEFAULT 150,
            "priorityListingFee" INTEGER NOT NULL DEFAULT 200,
            "verifiedListingFee" INTEGER NOT NULL DEFAULT 250,
            "currency" TEXT NOT NULL DEFAULT 'ج.م',
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);
      }
    }

    migrationDone = true;
    return true;
  } catch (error) {
    console.error('[Settings Migration] Error:', error);
    return false;
  }
}

// GET - جلب الإعدادات (public)
export async function GET() {
  try {
    await ensureSettingsTable();

    let settings = await db.settings.findFirst();

    if (!settings) {
      settings = await db.settings.create({ data: DEFAULT_SETTINGS });
    }

    return NextResponse.json(
      { settings },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' } }
    );
  } catch (error) {
    console.error("Get settings error:", error);
    
    // Return defaults so the app never breaks
    return NextResponse.json({ settings: DEFAULT_SETTINGS });
  }
}

// PUT - تحديث الإعدادات (developer only)
export async function PUT(request: Request) {
  try {
    if (!(await isDeveloper(request))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
    }

    const body = await request.json();

    const validatedData = {
      contactFee: validateFee(body.contactFee),
      regularFee: validateFee(body.regularFee),
      featuredFee: validateFee(body.featuredFee),
      premiumFee: validateFee(body.premiumFee),
      vipFee: validateFee(body.vipFee),
      saleDisplayFee: validateFee(body.saleDisplayFee),
      rentDisplayFee: validateFee(body.rentDisplayFee),
      otherServicesFee: validateFee(body.otherServicesFee),
      highlightFee: validateFee(body.highlightFee),
      priorityListingFee: validateFee(body.priorityListingFee),
      verifiedListingFee: validateFee(body.verifiedListingFee),
      currency: validateCurrency(body.currency),
    };

    await ensureSettingsTable();

    let settings = await db.settings.findFirst();

    if (!settings) {
      settings = await db.settings.create({ data: validatedData });
    } else {
      settings = await db.settings.update({
        where: { id: settings.id },
        data: validatedData,
      });
    }

    // Log settings change
    const currentUserId = await getCurrentUserId(request);
    try {
      await db.operationLog.create({
        data: {
          action: 'UPDATE_SETTINGS',
          entityType: 'Settings',
          entityId: settings.id,
          userId: currentUserId,
          details: JSON.stringify(validatedData),
        },
      });
    } catch {}

    // Notify ALL connected clients
    notifyRealtime('settings-updated', validatedData);

    return NextResponse.json({
      message: "تم تحديث الإعدادات بنجاح ✅",
      settings,
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء تحديث الإعدادات" },
      { status: 500 }
    );
  }
}
