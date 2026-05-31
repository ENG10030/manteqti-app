import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verify } from "jsonwebtoken";

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

export async function POST(request: Request) {
  try {
    if (!(await isDeveloper(request))) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgres = dbUrl.startsWith('postgres') || dbUrl.startsWith('postgresql');

    const results: string[] = [];

    if (isPostgres) {
      // All table names use lowercase (via @@map in schema.postgres.prisma)
      // Column names use snake_case (via @map in schema.postgres.prisma)

      // 1. Ensure settings table exists
      const settingsExists = await db.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'settings') as "exists"
      `;

      if (!settingsExists[0]?.exists) {
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
        results.push('✅ تم إنشاء جدول الإعدادات');
      } else {
        // Add missing columns
        const existingColumns = await db.$queryRaw<Array<{ column_name: string }>>`
          SELECT column_name FROM information_schema.columns WHERE table_name = 'settings'
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
            results.push(`✅ تم إضافة العمود: ${col}`);
          }
        }

        if (results.length === 0) {
          results.push('✅ جدول الإعدادات: جميع الأعمدة موجودة');
        }
      }

      // 2. Ensure operation_logs table exists
      const opLogExists = await db.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'operation_logs') as "exists"
      `;
      if (!opLogExists[0]?.exists) {
        await db.$executeRawUnsafe(`
          CREATE TABLE "operation_logs" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "action" TEXT NOT NULL,
            "entity_type" TEXT,
            "entity_id" TEXT,
            "details" TEXT,
            "user_id" TEXT,
            "ip_address" TEXT,
            "user_agent" TEXT,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);
        results.push('✅ تم إنشاء جدول سجلات العمليات');
      } else {
        results.push('✅ جدول سجلات العمليات: موجود');
      }

      // 3. Check settings has data
      const settingsCount = await db.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int as "count" FROM "settings"
      `;
      if (settingsCount[0]?.count === 0) {
        await db.$executeRawUnsafe(`
          INSERT INTO "settings" ("id", "contact_fee", "regular_fee", "featured_fee", "premium_fee", "vip_fee", "sale_display_fee", "rent_display_fee", "other_services_fee", "highlight_fee", "priority_listing_fee", "verified_listing_fee", "currency")
          VALUES (gen_random_uuid()::text, 50, 30, 100, 200, 300, 100, 75, 50, 150, 200, 250, 'ج.م')
        `);
        results.push('✅ تم إنشاء إعدادات افتراضية');
      } else {
        results.push('✅ الإعدادات: بيانات موجودة');
      }

    } else {
      results.push('✅ SQLite - لا حاجة لمزامنة');
    }

    return NextResponse.json({
      success: true,
      message: 'تم مزامنة قاعدة البيانات بنجاح',
      results,
    });
  } catch (error) {
    console.error('Sync schema error:', error);
    return NextResponse.json(
      { error: 'فشل مزامنة قاعدة البيانات', details: String(error) },
      { status: 500 }
    );
  }
}
