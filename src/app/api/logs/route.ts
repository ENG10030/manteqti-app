import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireDeveloper } from '@/lib/auth';

/**
 * GET /api/logs
 * Require developer auth. Return operation logs.
 * Query params: ?limit=50, ?clearAll=true
 */
export async function GET(request: NextRequest) {
  try {
    const decoded = await requireDeveloper(request);
    if (decoded instanceof Response) return decoded;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const logs = await db.operationLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      include: {
        user: { select: { id: true, name: true, identifier: true } },
      },
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * DELETE /api/logs
 * Require developer auth. Delete log entry or clear all.
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
      await db.operationLog.deleteMany({});
      return NextResponse.json({ success: true, message: 'تم حذف جميع السجلات ✅' });
    }

    if (!id) {
      return NextResponse.json({ error: 'معرف السجل مطلوب' }, { status: 400 });
    }

    const existingLog = await db.operationLog.findUnique({
      where: { id },
    });

    if (!existingLog) {
      return NextResponse.json({ error: 'السجل غير موجود' }, { status: 404 });
    }

    await db.operationLog.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting log:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
