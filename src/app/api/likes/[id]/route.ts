import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// حذف إعجاب (بواسطة ID الإعجاب أو apartmentId + userId)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const apartmentId = searchParams.get('apartmentId');
    const userId = searchParams.get('userId');

    // إذا كان ID هو apartmentId وتم تمرير userId
    if (apartmentId && userId) {
      await db.like.deleteMany({
        where: {
          apartmentId: id,
          userId,
        }
      });
    } else {
      // حذف بواسطة ID الإعجاب
      await db.like.delete({
        where: { id },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting like:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
