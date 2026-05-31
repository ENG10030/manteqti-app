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
      // PostgreSQL sync
      // 1. Ensure Settings table exists
      const tableExists = await db.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'Settings') as "exists"
      `;

      if (!tableExists[0]?.exists) {
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
        results.push('✅ تم إنشاء جدول الإعدادات');
      } else {
        // Check for missing columns
        const existingColumns = await db.$queryRaw<Array<{ column_name: string }>>`
          SELECT column_name FROM information_schema.columns WHERE table_name = 'Settings'
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
            await db.$executeRawUnsafe(`ALTER TABLE "Settings" ADD COLUMN "${colName}" ${colDef}`);
            results.push(`✅ تم إضافة العمود: ${colName}`);
          }
        }

        if (results.length === 0) {
          results.push('✅ جميع الأعمدة موجودة');
        }
      }

      // 2. Ensure OperationLog table exists
      const opLogExists = await db.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'OperationLog') as "exists"
      `;
      if (!opLogExists[0]?.exists) {
        await db.$executeRaw`
          CREATE TABLE "OperationLog" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "action" TEXT NOT NULL,
            "entityType" TEXT,
            "entityId" TEXT,
            "details" TEXT,
            "userId" TEXT,
            "ipAddress" TEXT,
            "userAgent" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `;
        results.push('✅ تم إنشاء جدول سجلات العمليات');
      }

      // 3. Ensure ApprovalLog table exists
      const approvalLogExists = await db.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'ApprovalLog') as "exists"
      `;
      if (!approvalLogExists[0]?.exists) {
        await db.$executeRaw`
          CREATE TABLE "ApprovalLog" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "userId" TEXT NOT NULL,
            "action" TEXT NOT NULL,
            "userName" TEXT NOT NULL,
            "userEmail" TEXT,
            "reason" TEXT,
            "performedBy" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `;
        results.push('✅ تم إنشاء جدول سجلات التأكيدات');
      }

      // 4. Check Settings has data
      const settingsCount = await db.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint as "count" FROM "Settings"
      `;
      if (settingsCount[0]?.count === 0n) {
        await db.$executeRaw`
          INSERT INTO "Settings" ("id", "contactFee", "regularFee", "featuredFee", "premiumFee", "vipFee", "saleDisplayFee", "rentDisplayFee", "otherServicesFee", "highlightFee", "priorityListingFee", "verifiedListingFee", "currency")
          VALUES (gen_random_uuid()::text, 50, 30, 100, 200, 300, 100, 75, 50, 150, 200, 250, 'ج.م')
        `;
        results.push('✅ تم إنشاء إعدادات افتراضية');
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
