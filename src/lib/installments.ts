// نظام الأقساط — تعقيم وتوحيد بيانات الأقساط القادمة من العميل
// نفس نهج ownership-docs: النصوص بدون وسوم، الأرقام مقيّدة، التعداد مُقفول

export const INSTALLMENT_FREQUENCIES = ['monthly', 'quarterly', 'annual'] as const;

export const INSTALLMENT_FREQUENCY_LABELS: Record<string, string> = {
  monthly: 'شهري',
  quarterly: 'ربعي (كل 3 شهور)',
  annual: 'سنوي',
};

export type InstallmentsData = {
  hasInstallments: boolean;
  remainingInstallments: number | null;
  installmentAmount: number | null;
  installmentFrequency: string | null;
  installmentsNotes: string | null;
};

// القيم الفارغة المسموح بها (0 قسط غير منطقي لكن 0 جنيه قسط مجاني ممكن؟ لا — نرفض السالب فقط)
function toCappedInt(v: unknown, max: number): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? Math.trunc(v) : parseInt(String(v), 10);
  if (isNaN(n) || n < 0) return null;
  return Math.min(n, max);
}

// POST: يرجّع كائناً كاملاً دائماً (يُستخدم في create)
export function sanitizeInstallments(body: Record<string, unknown>): InstallmentsData {
  const has = body?.hasInstallments === true || body?.hasInstallments === 'true';
  if (!has) {
    return { hasInstallments: false, remainingInstallments: null, installmentAmount: null, installmentFrequency: null, installmentsNotes: null };
  }
  const freq = INSTALLMENT_FREQUENCIES.includes(body?.installmentFrequency as never)
    ? String(body.installmentFrequency)
    : null;
  const notes = String(body?.installmentsNotes ?? '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, 1000);
  return {
    hasInstallments: true,
    remainingInstallments: toCappedInt(body?.remainingInstallments, 1200), // حتى 100 سنة بقسط شهري
    installmentAmount: toCappedInt(body?.installmentAmount, 100_000_000),
    installmentFrequency: freq,
    installmentsNotes: notes || null,
  };
}

// PUT: "لم يُرسل" = تجاهل (undefined) — أُرسل false = مسح كل الأقساط — أُرسل true = حفظ القيم
export function buildInstallmentsUpdate(body: Record<string, unknown>): Partial<InstallmentsData> {
  if (body?.hasInstallments === undefined) return {};
  const full = sanitizeInstallments(body);
  return {
    hasInstallments: full.hasInstallments,
    remainingInstallments: full.remainingInstallments,
    installmentAmount: full.installmentAmount,
    installmentFrequency: full.installmentFrequency,
    installmentsNotes: full.installmentsNotes,
  };
}
