import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApprovedUser } from '@/lib/auth-middleware';

export const dynamic = "force-dynamic";

// الموافقة على التعليق أو رفضه
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { auth, errorResponse } = await requireApprovedUser(request);
    if (errorResponse) return errorResponse;
    if (auth.role !== 'DEVELOPER') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'حالة غير صالحة' }, { status: 400 });
    }

    const comment = await db.comment.update({
      where: { id },
      data: { status },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            identifier: true,
          }
        }
      }
    });

    return NextResponse.json({ 
      success: true, 
      comment,
      message: status === 'approved' ? 'تمت الموافقة على التعليق' : 'تم رفض التعليق'
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// حذف التعليق
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { auth, errorResponse } = await requireApprovedUser(request);
    if (errorResponse) return errorResponse;
    if (auth.role !== 'DEVELOPER') return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });

    const { id } = await params;

    await db.comment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'تم حذف التعليق' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
