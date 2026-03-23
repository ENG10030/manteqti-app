import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Cron job to auto-delete apartments after 48 hours in final status
// This endpoint should be called by Vercel Cron or external scheduler

// Final statuses that trigger auto-delete after 48 hours
const FINAL_STATUSES = ['sold', 'unavailable', 'rented'];
const HOURS_UNTIL_DELETE = 48;

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security (optional but recommended)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Calculate the cutoff time (48 hours ago)
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - HOURS_UNTIL_DELETE);

    // Find apartments that should be deleted
    const apartmentsToDelete = await db.apartment.findMany({
      where: {
        status: { in: FINAL_STATUSES },
        statusChangedAt: { lte: cutoffTime }
      }
    });

    console.log(`Found ${apartmentsToDelete.length} apartments to delete`);

    const deletedIds: string[] = [];
    const errors: string[] = [];

    // Delete each apartment
    for (const apartment of apartmentsToDelete) {
      try {
        // Log the auto-delete operation
        await db.operationLog.create({
          data: {
            action: 'auto_delete',
            entityType: 'apartment',
            entityId: apartment.id,
            details: `Auto-deleted after 48 hours in status: ${apartment.status} - ${apartment.title}`
          }
        });

        // Delete the apartment
        await db.apartment.delete({
          where: { id: apartment.id }
        });

        deletedIds.push(apartment.id);
        console.log(`Deleted apartment: ${apartment.title} (${apartment.id})`);
      } catch (error) {
        console.error(`Failed to delete apartment ${apartment.id}:`, error);
        errors.push(apartment.id);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Auto-delete completed`,
      deletedCount: deletedIds.length,
      deletedIds,
      errorsCount: errors.length,
      errors,
      checkedStatuses: FINAL_STATUSES,
      hoursThreshold: HOURS_UNTIL_DELETE
    });
  } catch (error) {
    console.error('Error in auto-delete cron:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to run auto-delete' 
    }, { status: 500 });
  }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
