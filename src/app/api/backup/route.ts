import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com';

// Rate limiting for backup endpoint (3 attempts per 15 minutes)
const backupRateLimit = new Map<string, { count: number; windowStart: number }>();

function checkBackupRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = backupRateLimit.get(ip);
  if (!entry || now - entry.windowStart > 15 * 60 * 1000) {
    backupRateLimit.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count += 1;
  return true;
}

// Verify developer via JWT cookie ONLY (no password fallback for security)
async function verifyDev(request: NextRequest): Promise<boolean> {
  const cookieHeader = request.headers.get('cookie');
  const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, '&') || '');
  const token = cookies.get('auth-token');

  if (token && JWT_SECRET) {
    try {
      const decoded = verify(token, JWT_SECRET!) as unknown as { userId: string; role?: string; identifier?: string };
      if (decoded.role === 'DEVELOPER' || decoded.identifier === DEVELOPER_EMAIL) return true;
      const user = await db.user.findUnique({
        where: { id: decoded.userId },
        select: { role: true, identifier: true },
      });
      if (user?.role === 'DEVELOPER' || user?.identifier === DEVELOPER_EMAIL) return true;
    } catch {}
  }

  // ⛔ NO PASSWORD FALLBACK - JWT only for security
  return false;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkBackupRateLimit(clientIp)) {
      return NextResponse.json({ error: 'طلبات كثيرة. يرجى المحاولة بعد 15 دقيقة' }, { status: 429 });
    }

    // Verify developer via JWT ONLY (before parsing body)
    const isDev = await verifyDev(request);
    if (!isDev) {
      return NextResponse.json({ error: 'غير مصرح لك' }, { status: 403 });
    }

    // Parse body after auth check
    let body: any;
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const { action } = body;

    if (action === 'export') {
      // Export all data as JSON backup
      const [
        apartments,
        users,
        comments,
        payments,
        inquiries,
        messages,
        likes,
        settings,
        editRequests,
        approvalLogs,
        operationLogs,
        commentActionLogs,
      ] = await Promise.all([
        db.apartment.findMany({ orderBy: { createdAt: 'desc' } }),
        db.user.findMany({ orderBy: { createdAt: 'desc' } }),
        db.comment.findMany({ orderBy: { createdAt: 'desc' } }),
        db.payment.findMany({ orderBy: { createdAt: 'desc' } }),
        db.inquiry.findMany({ orderBy: { createdAt: 'desc' } }),
        db.message.findMany({ orderBy: { createdAt: 'desc' } }),
        db.like.findMany({ orderBy: { createdAt: 'desc' } }),
        db.settings.findFirst(),
        db.propertyEditRequest.findMany({ orderBy: { createdAt: 'desc' } }),
        db.approvalLog.findMany({ orderBy: { createdAt: 'desc' } }),
        db.operationLog.findMany({ orderBy: { createdAt: 'desc' } }),
        db.commentActionLog.findMany({ orderBy: { createdAt: 'desc' } }),
      ]);

      const backup = {
        version: 'v223',
        exportedAt: new Date().toISOString(),
        counts: {
          apartments: apartments.length,
          users: users.length,
          comments: comments.length,
          payments: payments.length,
          inquiries: inquiries.length,
          messages: messages.length,
          likes: likes.length,
          editRequests: editRequests.length,
          approvalLogs: approvalLogs.length,
          operationLogs: operationLogs.length,
          commentActionLogs: commentActionLogs.length,
        },
        data: {
          apartments,
          users,
          comments,
          payments,
          inquiries,
          messages,
          likes,
          settings,
          editRequests,
          approvalLogs,
          operationLogs,
          commentActionLogs,
        },
      };

      return NextResponse.json({ success: true, backup });
    }

    if (action === 'import') {
      // Restore from JSON backup (body already parsed at top)
      const { backup } = body;
      if (!backup || !backup.data) {
        return NextResponse.json({ error: 'بيانات النسخة الاحتياطية غير صالحة' }, { status: 400 });
      }

      const { apartments, users, comments, payments, inquiries, messages, likes, settings, editRequests, approvalLogs, operationLogs, commentActionLogs } = backup.data;
      const results: Record<string, number> = {};

      // Helper to import with upsert
      async function importMany(model: any, records: any[], uniqueFields: string[]) {
        if (!records || records.length === 0) return 0;
        let imported = 0;
        for (const record of records) {
          try {
            // Clean the record - remove id for new insert, keep for existing
            const cleanRecord = { ...record };
            const whereClause: any = {};
            for (const field of uniqueFields) {
              whereClause[field] = cleanRecord[field];
            }
            // Try to find existing
            const existing = await model.findFirst({ where: whereClause });
            if (existing) {
              // Update existing
              const { id, createdAt, updatedAt, ...updateData } = cleanRecord;
              await model.update({ where: { id: existing.id }, data: updateData });
            } else {
              // Create new (remove id to auto-generate)
              const { id, ...createData } = cleanRecord;
              await model.create({ data: createData });
            }
            imported++;
          } catch (e) {
            // Skip failed records
            console.error(`Import error for record:`, e);
          }
        }
        return imported;
      }

      // Import in order (users first, then apartments, then related data)
      if (users) results.users = await importMany(db.user, users, ['identifier']);
      if (settings) {
        try {
          const existingSettings = await db.settings.findFirst();
          if (existingSettings) {
            const { id, createdAt, updatedAt, ...updateData } = settings;
            await db.settings.update({ where: { id: existingSettings.id }, data: updateData });
          } else {
            const { id, ...createData } = settings;
            await db.settings.create({ data: createData });
          }
          results.settings = 1;
        } catch (e) {
          console.error('Settings import error:', e);
          results.settings = 0;
        }
      }
      if (apartments) results.apartments = await importMany(db.apartment, apartments, ['title', 'userId']);
      if (comments) results.comments = await importMany(db.comment, comments, ['id']);
      if (payments) results.payments = await importMany(db.payment, payments, ['id']);
      if (inquiries) results.inquiries = await importMany(db.inquiry, inquiries, ['id']);
      if (messages) results.messages = await importMany(db.message, messages, ['id']);
      if (likes) results.likes = await importMany(db.like, likes, ['userId', 'apartmentId']);
      if (editRequests) results.editRequests = await importMany(db.propertyEditRequest, editRequests, ['id']);
      if (approvalLogs) results.approvalLogs = await importMany(db.approvalLog, approvalLogs, ['id']);
      if (operationLogs) results.operationLogs = await importMany(db.operationLog, operationLogs, ['id']);
      if (commentActionLogs) results.commentActionLogs = await importMany(db.commentActionLog, commentActionLogs, ['id']);

      return NextResponse.json({
        success: true,
        message: 'تم استعادة النسخة الاحتياطية بنجاح',
        results,
      });
    }

    return NextResponse.json({ error: 'إجراء غير صالح. استخدم action: export أو import' }, { status: 400 });
  } catch (error) {
    console.error('Backup API error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء العملية' }, { status: 500 });
  }
}