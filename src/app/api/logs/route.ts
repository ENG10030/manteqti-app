import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Get operation logs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const action = searchParams.get('action');
    const entityType = searchParams.get('entityType');
    
    const where: any = {};
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    
    // Check if OperationLog table exists
    let logs: any[] = [];
    try {
      logs = await db.operationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit
      });
    } catch (tableError) {
      // Table might not exist yet, return empty array
      console.log('OperationLog table might not exist yet');
      return NextResponse.json([]);
    }
    
    // Transform dates to strings
    const transformedLogs = logs.map(log => ({
      ...log,
      createdAt: log.createdAt instanceof Date ? log.createdAt.toISOString() : log.createdAt
    }));
    
    return NextResponse.json(transformedLogs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    // Return empty array instead of error to prevent UI crash
    return NextResponse.json([]);
  }
}

// Create operation log
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    let log;
    try {
      log = await db.operationLog.create({
        data: {
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          userId: data.userId,
          details: data.details
        }
      });
    } catch (tableError) {
      // Table might not exist, return success anyway
      return NextResponse.json({ success: true, message: 'Log skipped' });
    }
    
    return NextResponse.json(log);
  } catch (error) {
    console.error('Error creating log:', error);
    return NextResponse.json({ success: true, message: 'Log skipped' });
  }
}
