import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDeveloper } from '@/lib/auth';

/**
 * GET /api/approval-logs
 * Require developer auth. Return approval logs.
 * Query params: ?limit=100
 */
export async function GET(request: NextRequest) {
  try {
    const decoded = await requireDeveloper(request);
    if (decoded instanceof Response) return decoded;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');

    const approvalLogs = await db.approvalLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });

    return NextResponse.json(approvalLogs);
  } catch (error) {
    console.error('Error fetching approval logs:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * DELETE /api/approval-logs
 * Require developer auth. Delete approval log entry or clear all.
 * Query params: ?id=logId or ?clearAll=true
 */
export async function DELETE(request: NextRequest) {
  try {
    const decoded = await requireDeveloper(request);
    if (decoded instanceof Response) return decoded;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const clearAll = searchParams.get('clearAll') === 'true';

    if (clearAll) {
      await db.approvalLog.deleteMany({});
      return NextResponse.json({ success: true, message: 'تم حذف جميع سجلات التأكيد ✅' });
    }

    if (!id) {
      return NextResponse.json({ error: 'معرف السجل مطلوب' }, { status: 400 });
    }

    const existingLog = await db.approvalLog.findUnique({
      where: { id },
    });

    if (!existingLog) {
      return NextResponse.json({ error: 'السجل غير موجود' }, { status: 404 });
    }

    await db.approvalLog.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting approval log:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
