import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();

    const inquiry = await db.inquiry.update({
      where: { id },
      data: {
        lifecycleStatus: data.lifecycleStatus
      }
    });

    return NextResponse.json({
      id: inquiry.id,
      lifecycleStatus: inquiry.lifecycleStatus
    });
  } catch (error) {
    console.error('Error updating inquiry:', error);
    return NextResponse.json({ error: 'Failed to update inquiry' }, { status: 500 });
  }
}
