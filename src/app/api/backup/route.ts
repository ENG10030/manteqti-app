import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Simple dev password check (same as dev panel)
async function verifyDev(request: NextRequest) {
  const { password } = await request.json().catch(() => ({}));
  const devPassword = process.env.DEV_PASSWORD || 'dev1234';
  return password === devPassword;
}

export async function POST(request: NextRequest) {
  try {
    // Verify developer
    if (!(await verifyDev(request))) {
      return NextResponse.json({ error: 'كلمة مرور المطور غير صحيحة' }, { status: 403 });
    }

    const { action } = await request.json().catch(() => ({}));

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
        db.editRequest.findMany({ orderBy: { createdAt: 'desc' } }),
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
      // Restore from JSON backup
      const { backup } = await request.json();
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
          const existingSettings = await db.siteSettings.findFirst();
          if (existingSettings) {
            const { id, createdAt, updatedAt, ...updateData } = settings;
            await db.siteSettings.update({ where: { id: existingSettings.id }, data: updateData });
          } else {
            const { id, ...createData } = settings;
            await db.siteSettings.create({ data: createData });
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
      if (editRequests) results.editRequests = await importMany(db.editRequest, editRequests, ['id']);
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
