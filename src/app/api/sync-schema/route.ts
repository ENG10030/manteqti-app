import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { requireDeveloper } from "@/lib/auth-middleware";

// ============================================================
// مزامنة قاعدة البيانات الشاملة (Schema-Driven)
// تقرأ كل الموديلات من Prisma وتضيف أي جدول/عمود ناقص تلقائياً،
// وتكشف اختلافات الأنواع — فلا تحتاج تعديل يدوي مع كل تحديث.
// تدعم Postgres (الإنتاج/Supabase) و SQLite (التطوير المحلي).
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

const SQLITE_TYPES: Record<string, string> = {
  String: "TEXT",
  Int: "INTEGER",
  BigInt: "INTEGER",
  Float: "REAL",
  Decimal: "DECIMAL",
  Boolean: "BOOLEAN",
  DateTime: "DATETIME",
  Json: "TEXT",
  Bytes: "BLOB",
};

// اسم النوع كما يظهر في information_schema.data_type (للمقارنة — Postgres فقط)
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

function sqlDefault(field: any, isPostgres: boolean): string {
  const d = field.default as any;
  if (d === null || d === undefined) return "";
  if (typeof d === "object") {
    if (d.name === "now") return " DEFAULT CURRENT_TIMESTAMP";
    return ""; // cuid/uuid/autoincrement — يتولدها Prisma من ناحية العميل
  }
  if (field.type === "String") return ` DEFAULT '${String(d).replace(/'/g, "''")}'`;
  if (field.type === "Boolean") {
    const lit = isPostgres ? (d ? "true" : "false") : d ? "1" : "0";
    return ` DEFAULT ${lit}`;
  }
  if (field.type === "Int" || field.type === "Float" || field.type === "BigInt" || field.type === "Decimal") return ` DEFAULT ${d}`;
  return "";
}

export async function POST(request: Request) {
  try {
    const { auth, errorResponse } = await requireDeveloper(request as any);
    if (errorResponse) return errorResponse;

    const dbUrl = process.env.DATABASE_URL || "";
    const isPostgres = dbUrl.startsWith("postgres");
    const isSqlite = dbUrl.startsWith("file:") || dbUrl.includes(".db");

    if (!isPostgres && !isSqlite) {
      return NextResponse.json(
        { error: "نوع قاعدة البيانات غير مدعوم للمزامنة (متوقع postgres أو file:)" },
        { status: 400 }
      );
    }

    const results: string[] = [];
    const types = isPostgres ? PG_TYPES : SQLITE_TYPES;

    const models = Prisma.dmmf.datamodel.models;
    results.push(`📦 فحص ${models.length} جدول مقابل الـ Schema (${isPostgres ? "Postgres" : "SQLite"})...`);

    for (const model of models) {
      const table = model.dbName || model.name;
      try {
        // 1) هل الجدول موجود؟
        let tableExists = false;
        if (isPostgres) {
          const exists = await db.$queryRaw<Array<{ exists: boolean }>>`
            SELECT EXISTS (
              SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = ${table}
            ) as "exists"
          `;
          tableExists = !!exists[0]?.exists;
        } else {
          const rows = await db.$queryRaw<Array<{ name: string }>>`
            SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${table}
          `;
          tableExists = rows.length > 0;
        }

        if (!tableExists) {
          // إنشاء الجدول كاملاً بكل الأعمدة
          const cols = model.fields
            .filter((f) => f.kind === "scalar" && !f.isList)
            .map((f) => {
              const col = f.dbName || f.name;
              const type = types[f.type] || "TEXT";
              if (f.isId) return `"${col}" ${type} PRIMARY KEY`;
              return `"${col}" ${type}${sqlDefault(f, isPostgres)}`;
            });
          await db.$executeRawUnsafe(`CREATE TABLE "${table}" (${cols.join(", ")})`);
          results.push(`🆕 تم إنشاء الجدول: ${table}`);
          continue;
        }

        // 2) مقارنة الأعمدة الموجودة
        let colMap: Map<string, string>;
        if (isPostgres) {
          const existing = await db.$queryRaw<Array<{ column_name: string; data_type: string }>>`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = ${table}
          `;
          colMap = new Map(existing.map((c) => [c.column_name, c.data_type]));
        } else {
          const existing = await db.$queryRaw<Array<{ name: string; type: string }>>`
            PRAGMA table_info(${Prisma.raw(`"${table}"`)})
          `;
          colMap = new Map(existing.map((c) => [c.name.toLowerCase(), (c.type || "").toLowerCase()]));
        }

        let added = 0;
        let typeWarnings = 0;

        for (const f of model.fields) {
          if (f.kind !== "scalar" || f.isList) continue;
          const col = f.dbName || f.name;

          if (!colMap.has(isPostgres ? col : col.toLowerCase())) {
            // عمود ناقص → إضافته (بدون NOT NULL حتى لا يفشل مع صفوف موجودة)
            const type = types[f.type] || "TEXT";
            const dflt = f.isId ? "" : sqlDefault(f, isPostgres);
            await db.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${col}" ${type}${dflt}`);
            results.push(`✅ [${table}] تم إضافة العمود: ${col}`);
            added++;
            continue;
          }

          // فحص اختلاف النوع (تشخيص فقط — Postgres لأن SQLite ديناميكي الأنواع)
          if (isPostgres) {
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
      const count = await db.settings.count();
      if (count === 0) {
        const newId = randomUUID().replace(/'/g, "");
        const settingsModel = models.find((m) => m.name === "Settings");
        const settingsTable = settingsModel ? (settingsModel.dbName || settingsModel.name) : "Settings";
        // ⚠️ createdAt/updatedAt تُكتب صراحة — الإدخال بـ "id" فقط يتركهما null ويكسر كل قراءات Prisma اللاحقة
        await db.$executeRawUnsafe(
          `INSERT INTO "${settingsTable}" ("id", "createdAt", "updatedAt") VALUES ('${newId}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
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
