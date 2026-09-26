import { db } from '@/lib/db';

// الأرشفة والحذف التلقائي
// المرحلة 1: العقارات التي وصلت لحالة نهائية (تم البيع / تم التأجير / غير متاح)
//             تُخفى من العرض تلقائياً بعد 48 ساعة — دون حذف، ويمكن استعادتها من لوحة المطور
// المرحلة 2 (جديدة v8): أي عقار مضى على أرشفته 48 ساعة يُحذف نهائياً تلقائياً
//             (الحذف يشمل كل ما له من علاقات: استفسارات/إعجابات/تعليقات/طلبات تعديل/مدفوعات — Cascade)

export const FINAL_STATUSES = ['sold', 'rented', 'unavailable'];
export const HOURS_UNTIL_ARCHIVE = 48;
export const HOURS_IN_ARCHIVE_BEFORE_DELETE = 48;

export interface AutoArchiveResult {
  archivedCount: number;
  archivedIds: string[];
  deletedCount: number;
  deletedIds: string[];
  errors: string[];
  checkedStatuses: string[];
  hoursThreshold: number;
  hoursInArchiveBeforeDelete: number;
  ranAt: string;
}

// منع تكرار الفحص المتكرر (throttle) عند الاستدعاء التلقائي من داخل الطلبات
let lastLazyRun = 0;
const LAZY_THROTTLE_MS = 30 * 60 * 1000; // كل 30 دقيقة كحد أقصى

// المرحلة 1: أرشفة الحالات النهائية القديمة
async function archiveFinalStatusApartments(cutoffTime: Date): Promise<{ archivedIds: string[]; errors: string[] }> {
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

  return { archivedIds, errors };
}

// المرحلة 2 (v8): حذف نهائي تلقائي لما مضى على أرشفته 48 ساعة
async function deleteExpiredArchivedApartments(deleteCutoff: Date): Promise<{ deletedIds: string[]; errors: string[] }> {
  const toDelete = await db.apartment.findMany({
    where: { archivedAt: { lte: deleteCutoff } },
    select: { id: true, title: true, archivedAt: true },
  });

  const deletedIds: string[] = [];
  const errors: string[] = [];

  for (const apartment of toDelete) {
    try {
      // حذف نهائي — كل العلاقات تُحذف تلقائياً (onDelete: Cascade)
      await db.apartment.delete({ where: { id: apartment.id } });

      await db.operationLog.create({
        data: {
          action: 'auto_delete',
          entityType: 'apartment',
          entityId: apartment.id,
          details: `حذف نهائي تلقائي بعد 48 ساعة في الأرشيف - ${apartment.title}`,
        },
      });

      deletedIds.push(apartment.id);
      console.log(`Auto-DELETED expired archived apartment: ${apartment.title} (${apartment.id})`);
    } catch (error) {
      console.error(`Failed to delete archived apartment ${apartment.id}:`, error);
      errors.push(apartment.id);
    }
  }

  return { deletedIds, errors };
}

export async function runAutoArchive(): Promise<AutoArchiveResult> {
  // المرحلة 1: أرشفة ما مضى على حالته النهائية 48 ساعة
  const archiveCutoffTime = new Date();
  archiveCutoffTime.setHours(archiveCutoffTime.getHours() - HOURS_UNTIL_ARCHIVE);
  const archiveResult = await archiveFinalStatusApartments(archiveCutoffTime);

  // المرحلة 2: حذف نهائي لما مضى على أرشفته 48 ساعة
  const deleteCutoff = new Date();
  deleteCutoff.setHours(deleteCutoff.getHours() - HOURS_IN_ARCHIVE_BEFORE_DELETE);
  const deleteResult = await deleteExpiredArchivedApartments(deleteCutoff);

  return {
    archivedCount: archiveResult.archivedIds.length,
    archivedIds: archiveResult.archivedIds,
    deletedCount: deleteResult.deletedIds.length,
    deletedIds: deleteResult.deletedIds,
    errors: [...archiveResult.errors, ...deleteResult.errors],
    checkedStatuses: FINAL_STATUSES,
    hoursThreshold: HOURS_UNTIL_ARCHIVE,
    hoursInArchiveBeforeDelete: HOURS_IN_ARCHIVE_BEFORE_DELETE,
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
    if (result.deletedCount > 0) {
      console.log(`Lazy auto-delete: ${result.deletedCount} expired archived apartments deleted permanently`);
    }
  } catch (error) {
    console.error('Lazy auto-archive failed (ignored):', error);
  }
}
