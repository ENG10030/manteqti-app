import { NextResponse } from "next/server";
import { syncDatabaseSchema } from "@/lib/schema-sync";
import { requireDeveloper } from "@/lib/auth-middleware";

// ============================================================
// مزامنة قاعدة البيانات الشاملة (Schema-Driven)
// النواة في src/lib/schema-sync.ts — مشتركة مع الإصلاح الذاتي
// في /api/settings و /api/apartments عند فشل التحديث بسبب
// عمود/جدول ناقص (drift) حتى تُحل المشكلة تلقائياً.
// ============================================================

export async function POST(request: Request) {
  try {
    const { errorResponse } = await requireDeveloper(request as any);
    if (errorResponse) return errorResponse;

    const results = await syncDatabaseSchema();

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
