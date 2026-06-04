import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }
    let decoded: any;
    try {
      decoded = verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    if (decoded.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const action = searchParams.get('action');
    const entityType = searchParams.get('entityType');
    
    const where: any = {};
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    
    let logs: any[] = [];
    try {
      logs = await db.operationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit
      });
    } catch (tableError) {
      console.log('OperationLog table might not exist yet');
      return NextResponse.json([]);
    }
    
    const transformedLogs = logs.map(log => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      userId: log.userId,
      details: log.details,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt instanceof Date ? log.createdAt.toISOString() : String(log.createdAt)
    }));
    
    return NextResponse.json(transformedLogs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }
    let decoded: any;
    try {
      decoded = verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    if (decoded.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const data = await request.json();
    
    let log;
    try {
      log = await db.operationLog.create({
        data: {
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          userId: data.userId,
          details: data.details,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent
        }
      });
    } catch (tableError) {
      return NextResponse.json({ success: true, message: 'Log skipped' });
    }
    
    return NextResponse.json({
      ...log,
      createdAt: log.createdAt instanceof Date ? log.createdAt.toISOString() : String(log.createdAt)
    });
  } catch (error) {
    console.error('Error creating log:', error);
    return NextResponse.json({ success: true, message: 'Log skipped' });
  }
}

// Delete a specific log or clear all logs (developer only)
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }
    let decoded: any;
    try {
      decoded = verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    if (decoded.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const logId = searchParams.get('id');
    const clearAll = searchParams.get('clearAll');

    if (clearAll === 'true') {
      try {
        await db.operationLog.deleteMany({});
        return NextResponse.json({ message: 'تم حذف جميع السجلات' });
      } catch {
        return NextResponse.json({ error: 'فشل حذف السجلات' }, { status: 500 });
      }
    }

    if (!logId) {
      return NextResponse.json({ error: 'معرف السجل مطلوب' }, { status: 400 });
    }

    try {
      await db.operationLog.delete({ where: { id: logId } });
      return NextResponse.json({ message: 'تم حذف السجل' });
    } catch {
      return NextResponse.json({ error: 'فشل حذف السجل' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error deleting log:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
