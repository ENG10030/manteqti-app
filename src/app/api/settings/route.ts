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

// ============= AUTO-MIGRATION: Ensure Settings table exists with all columns =============
// This runs automatically on every GET/PUT request to handle cases where
// prisma db:push failed during Vercel build (Supabase unreachable from build server)

let migrationDone = false;

async function ensureSettingsTable(): Promise<boolean> {
  if (migrationDone) return true;

  try {
    // Check database type
    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgres = dbUrl.startsWith('postgres') || dbUrl.startsWith('postgresql');

    if (isPostgres) {
      // PostgreSQL - use pg_tables and information_schema
      // Step 1: Check if table exists
      const tableExists = await db.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT FROM pg_tables 
          WHERE tablename = 'Settings'
        ) as "exists"
      `;

      if (!tableExists[0]?.exists) {
        // Create the full table
        console.log('[Settings Auto-Migration] Creating Settings table...');
        await db.$executeRaw`
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
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `;
        console.log('[Settings Auto-Migration] Settings table created successfully');
      } else {
        // Table exists - check for missing columns
        const existingColumns = await db.$queryRaw<Array<{ column_name: string }>>`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'Settings'
        `;
        const columnNames = existingColumns.map(c => c.column_name);

        const requiredColumns: Record<string, string> = {
          contactFee: 'INTEGER NOT NULL DEFAULT 50',
          regularFee: 'INTEGER NOT NULL DEFAULT 30',
          featuredFee: 'INTEGER NOT NULL DEFAULT 100',
          premiumFee: 'INTEGER NOT NULL DEFAULT 200',
          vipFee: 'INTEGER NOT NULL DEFAULT 300',
          saleDisplayFee: 'INTEGER NOT NULL DEFAULT 100',
          rentDisplayFee: 'INTEGER NOT NULL DEFAULT 75',
          otherServicesFee: 'INTEGER NOT NULL DEFAULT 50',
          highlightFee: 'INTEGER NOT NULL DEFAULT 150',
          priorityListingFee: 'INTEGER NOT NULL DEFAULT 200',
          verifiedListingFee: 'INTEGER NOT NULL DEFAULT 250',
          currency: "TEXT NOT NULL DEFAULT 'ج.م'",
        };

        for (const [colName, colDef] of Object.entries(requiredColumns)) {
          if (!columnNames.includes(colName)) {
            console.log(`[Settings Auto-Migration] Adding missing column: ${colName}`);
            await db.$executeRawUnsafe(`ALTER TABLE "Settings" ADD COLUMN "${colName}" ${colDef}`);
          }
        }
      }
    } else {
      // SQLite - the table should exist from prisma db:push
      // If it doesn't, create it
      const tableExists = await db.$queryRaw<Array<{ name: string }>>`
        SELECT name FROM sqlite_master WHERE type='table' AND name='Settings'
      `;

      if (!tableExists || tableExists.length === 0) {
        console.log('[Settings Auto-Migration] Creating Settings table (SQLite)...');
        await db.$executeRaw`
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
        `;
      }
    }

    migrationDone = true;
    return true;
  } catch (error) {
    console.error('[Settings Auto-Migration] Error:', error);
    // Don't throw - let the main function try Prisma anyway
    return false;
  }
}

// GET - جلب الإعدادات (public)
export async function GET() {
  try {
    // Ensure table exists first
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
    
    // If DB operation fails completely, return defaults
    return NextResponse.json({
      settings: DEFAULT_SETTINGS,
      _note: "إعدادات افتراضية - لم يتم الاتصال بقاعدة البيانات"
    });
  }
}

// PUT - تحديث الإعدادات (developer only)
export async function PUT(request: Request) {
  try {
    if (!(await isDeveloper(request))) {
      return NextResponse.json({ error: "غير مصرح لك" }, { status: 403 });
    }

    const body = await request.json();

    // Server-side validation
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

    // Ensure table exists with all columns
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

    // Notify ALL connected clients about settings change
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
