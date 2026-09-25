import { PrismaClient } from "@prisma/client";

// ============================================================
// Prisma Client + إصلاح ذاتي لانجراف قاعدة البيانات (Schema Drift)
// ------------------------------------------------------------
// المشكلة: لما بنحدث الكود ونضيف أعمدة جديدة في الـ Prisma Schema،
// قاعدة بيانات الإنتاج (Postgres) بتفضل قديمة لحد ما تتزامن،
// وأي استعلام بيختار الأعمدة الجديدة بيفشل بخطأ P2022/P2021.
//
// الحل: لو أي استعلام فشل بسبب عمود/جدول ناقص:
//   1) بنشغّل المزامنة الشاملة (src/lib/schema-sync.ts) مرة واحدة
//   2) نعيد المحاولة تلقائياً
// فيشوف الموقع شغال من أول لحظة بعد التحديث بدون تدخل يدوي.
// ============================================================

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const baseClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = baseClient;

// حالة الإصلاح — تمنع التزامن والاستدعاء العشوائي (recursion)
let healing = false;
let healPromise: Promise<void> | null = null;

async function runHeal(): Promise<void> {
  if (healing) return;
  if (!healPromise) {
    healPromise = (async () => {
      healing = true;
      try {
        // استيراد ديناميكي لتجنب الاعتمادية الدائرية عند التحميل
        const { syncDatabaseSchema } = await import("./schema-sync");
        console.warn("[db] Schema drift detected — running auto-sync...");
        const results = await syncDatabaseSchema();
        const changed = results.filter((r) => r.startsWith("✅ [") || r.startsWith("🆕"));
        console.info(`[db] Auto-sync done. ${changed.length} change(s):`, changed.slice(0, 8));
      } finally {
        healing = false;
        healPromise = null;
      }
    })();
  }
  await healPromise;
}

export const db = baseClient.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        try {
          return await query(args);
        } catch (error) {
          // أثناء الإصلاح نفسه أو لو الخطأ مش drift → ارميه زي ما هو
          if (healing) throw error;
          const { isSchemaDriftError } = await import("./schema-sync");
          if (!isSchemaDriftError(error)) throw error;
          await runHeal();
          // إعادة المحاولة بعد إصلاح قاعدة البيانات
          return await query(args);
        }
      },
    },
  },
});
