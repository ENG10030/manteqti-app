import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireDeveloper } from "@/lib/auth-middleware";

// ============================================================
// مزامنة قاعدة البيانات الشاملة (Schema-Driven)
// تقرأ كل الموديلات من Prisma وتضيف أي جدول/عمود ناقص تلقائياً،
// وتكشف اختلافات الأنواع — فلا تحتاج تعديل يدوي مع كل تحديث.
// ============================================================

const PG_TYPES: Record<string, string> = {
  String: "TEXT",
  Int: "INTEGER",
  BigInt: "BIGINT",
  Float: "DOUBLE PRECISION",
  Decimal: "DECIMAL(65,30)",
  Boolean: "BOOLEAN",
  DateTime: "TIMESTAMP(3)",
  Json: "JSONB",
  Bytes: "BYTEA",
};

// اسم النوع كما يظهر في information_schema.data_type (للمقارنة)
const PG_INFO_TYPES: Record<string, string> = {
  String: "text",
  Int: "integer",
  BigInt: "bigint",
  Float: "double precision",
  Decimal: "numeric",
  Boolean: "boolean",
  DateTime: "timestamp without time zone",
  Json: "jsonb",
  Bytes: "bytea",
};

function sqlDefault(field: any): string {
  const d = field.default as any;
  if (d === null || d === undefined) return "";
  if (typeof d === "object") {
    if (d.name === "now") return " DEFAULT CURRENT_TIMESTAMP";
    return ""; // cuid/uuid/autoincrement — يتولدها Prisma من ناحية العميل
  }
  if (field.type === "String") return ` DEFAULT '${String(d).replace(/'/g, "''")}'`;
  if (field.type === "Boolean") return ` DEFAULT ${d ? "true" : "false"}`;
  if (field.type === "Int" || field.type === "Float" || field.type === "BigInt" || field.type === "Decimal") return ` DEFAULT ${d}`;
  return "";
}

export async function POST(request: Request) {
  try {
    const { auth, errorResponse } = await requireDeveloper(request as any);
    if (errorResponse) return errorResponse;

    const dbUrl = process.env.DATABASE_URL || "";
    const isPostgres = dbUrl.startsWith("postgres");

    const results: string[] = [];

    if (!isPostgres) {
      return NextResponse.json({
        success: true,
        message: "قاعدة البيانات المحلية (SQLite) لا تحتاج مزامنة",
        results: ["✅ SQLite — لا حاجة لمزامنة"],
      });
    }

    const models = Prisma.dmmf.datamodel.models;
    results.push(`📦 فحص ${models.length} جدول مقابل الـ Schema...`);

    for (const model of models) {
      const table = model.dbName || model.name;
      try {
        // 1) هل الجدول موجود؟
        const exists = await db.$queryRaw<Array<{ exists: boolean }>>`
          SELECT EXISTS (
            SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = ${table}
          ) as "exists"
        `;

        if (!exists[0]?.exists) {
          // إنشاء الجدول كاملاً بكل الأعمدة
          const cols = model.fields
            .filter((f) => f.kind === "scalar" && !f.isList)
            .map((f) => {
              const col = f.dbName || f.name;
              const type = PG_TYPES[f.type] || "TEXT";
              if (f.isId) return `"${col}" ${type} PRIMARY KEY`;
              return `"${col}" ${type}${sqlDefault(f)}`;
            });
          await db.$executeRawUnsafe(`CREATE TABLE "${table}" (${cols.join(", ")})`);
          results.push(`🆕 تم إنشاء الجدول: ${table}`);
          continue;
        }

        // 2) مقارنة الأعمدة الموجودة
        const existing = await db.$queryRaw<Array<{ column_name: string; data_type: string }>>`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = ${table}
        `;
        const colMap = new Map(existing.map((c) => [c.column_name, c.data_type]));

        let added = 0;
        let typeWarnings = 0;

        for (const f of model.fields) {
          if (f.kind !== "scalar" || f.isList) continue;
          const col = f.dbName || f.name;

          if (!colMap.has(col)) {
            // عمود ناقص → إضافته (بدون NOT NULL حتى لا يفشل مع صفوف موجودة)
            const type = PG_TYPES[f.type] || "TEXT";
            const dflt = f.isId ? "" : sqlDefault(f);
            await db.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${col}" ${type}${dflt}`);
            results.push(`✅ [${table}] تم إضافة العمود: ${col}`);
            added++;
            continue;
          }

          // فحص اختلاف النوع (تشخيص فقط)
          const expected = PG_INFO_TYPES[f.type];
          const actual = colMap.get(col) || "";
          const compatible =
            actual === expected ||
            (expected === "text" && actual === "character varying") ||
            (expected.startsWith("timestamp") && actual.startsWith("timestamp")) ||
            (expected === "double precision" && actual === "real");
          if (!compatible) {
            results.push(`⚠️ [${table}] اختلاف نوع العمود ${col}: المتوقع ${expected} / الموجود ${actual}`);
            typeWarnings++;
          }
        }

        if (added === 0 && typeWarnings === 0) {
          results.push(`✅ [${table}] مكتمل ومطابق`);
        }
      } catch (modelErr: any) {
        results.push(`❌ [${table}] خطأ: ${modelErr?.message || "غير معروف"}`);
      }
    }

    // 3) التأكد من وجود صف إعدادات افتراضي (جدول Settings)
    try {
      const settingsModel = models.find((m) => m.name === "Settings");
      const settingsTable = settingsModel ? (settingsModel.dbName || settingsModel.name) : "Settings";
      const count = await db.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as "count" FROM ${Prisma.raw(`"${settingsTable}"`)}
      `;
      if (Number(count[0]?.count ?? 0) === 0) {
        await db.$executeRawUnsafe(
          `INSERT INTO ${Prisma.raw(`"${settingsTable}"`)} ("id") VALUES (gen_random_uuid()::text)`
        );
        results.push("✅ تم إنشاء صف إعدادات افتراضي");
      }
    } catch (sErr: any) {
      results.push(`ℹ️ إعدادات: ${sErr?.message || "موجودة مسبقاً"}`);
    }

    return NextResponse.json({
      success: true,
      message: "تم فحص ومزامنة قاعدة البيانات بالكامل",
      results,
    });
  } catch (error) {
    console.error("Sync schema error:", error);
    return NextResponse.json({ error: "فشل مزامنة قاعدة البيانات" }, { status: 500 });
  }
}
