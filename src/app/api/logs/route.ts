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
    
    const logs = await db.operationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    
    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}

// Create operation log
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    const log = await db.operationLog.create({
      data: {
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        userId: data.userId,
        details: data.details
      }
    });
    
    return NextResponse.json(log);
  } catch (error) {
    console.error('Error creating log:', error);
    return NextResponse.json({ error: 'Failed to create log' }, { status: 500 });
  }
}
