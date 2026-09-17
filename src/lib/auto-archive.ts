import { db } from '@/lib/db';

// الأرشفة التلقائية بعد 48 ساعة
// العقارات التي وصلت لحالة نهائية (تم البيع / تم التأجير / غير متاح)
// تُخفى من العرض تلقائياً بعد 48 ساعة — دون حذف نهائي، ويمكن استعادتها من لوحة المطور

export const FINAL_STATUSES = ['sold', 'rented', 'unavailable'];
export const HOURS_UNTIL_ARCHIVE = 48;

export interface AutoArchiveResult {
  archivedCount: number;
  archivedIds: string[];
  errors: string[];
  checkedStatuses: string[];
  hoursThreshold: number;
  ranAt: string;
}

// منع تكرار الفحص المتكرر (throttle) عند الاستدعاء التلقائي من داخل الطلبات
let lastLazyRun = 0;
const LAZY_THROTTLE_MS = 30 * 60 * 1000; // كل 30 دقيقة كحد أقصى

export async function runAutoArchive(): Promise<AutoArchiveResult> {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - HOURS_UNTIL_ARCHIVE);

  const toArchive = await db.apartment.findMany({
    where: {
      status: { in: FINAL_STATUSES },
      statusChangedAt: { lte: cutoffTime },
      archivedAt: null,
    },
    select: { id: true, title: true, status: true },
  });

  const archivedIds: string[] = [];
  const errors: string[] = [];

  for (const apartment of toArchive) {
    try {
      await db.apartment.update({
        where: { id: apartment.id },
        data: { archivedAt: new Date() },
      });

      await db.operationLog.create({
        data: {
          action: 'auto_archive',
          entityType: 'apartment',
          entityId: apartment.id,
          details: `أرشفة تلقائية بعد 48 ساعة في حالة: ${apartment.status} - ${apartment.title}`,
        },
      });

      archivedIds.push(apartment.id);
      console.log(`Auto-archived apartment: ${apartment.title} (${apartment.id})`);
    } catch (error) {
      console.error(`Failed to archive apartment ${apartment.id}:`, error);
      errors.push(apartment.id);
    }
  }

  return {
    archivedCount: archivedIds.length,
    archivedIds,
    errors,
    checkedStatuses: FINAL_STATUSES,
    hoursThreshold: HOURS_UNTIL_ARCHIVE,
    ranAt: new Date().toISOString(),
  };
}

// استدعاء خفيف من داخل طلبات العرض — يعمل حتى بدون إعداد Vercel Cron
// لا يرمي أخطاء أبداً حتى لا يؤثر على عرض العقارات
export async function maybeRunAutoArchive(): Promise<void> {
  const now = Date.now();
  if (now - lastLazyRun < LAZY_THROTTLE_MS) return;
  lastLazyRun = now;
  try {
    const result = await runAutoArchive();
    if (result.archivedCount > 0) {
      console.log(`Lazy auto-archive: ${result.archivedCount} apartments archived`);
    }
  } catch (error) {
    console.error('Lazy auto-archive failed (ignored):', error);
  }
}
