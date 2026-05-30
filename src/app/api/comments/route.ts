import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';

/**
 * GET /api/comments
 * Return comments for an apartment.
 * Query param: ?apartmentId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apartmentId = searchParams.get('apartmentId');

    if (!apartmentId) {
      return NextResponse.json({ error: 'معرف العقار مطلوب' }, { status: 400 });
    }

    const comments = await db.comment.findMany({
      where: { apartmentId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * POST /api/comments
 * Require auth. Create comment.
 * Body: { apartmentId: string, content: string }
 */
export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyAuth(request);
    if (!decoded) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const body = await request.json();
    const { apartmentId, content } = body;

    if (!apartmentId || !content || !content.trim()) {
      return NextResponse.json({ error: 'معرف العقار والمحتوى مطلوبان' }, { status: 400 });
    }

    // Verify apartment exists
    const apartment = await db.apartment.findUnique({
      where: { id: apartmentId },
    });

    if (!apartment) {
      return NextResponse.json({ error: 'العقار غير موجود' }, { status: 404 });
    }

    const comment = await db.comment.create({
      data: {
        apartmentId,
        userId: decoded.id,
        content: content.trim(),
        status: 'approved',
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

/**
 * DELETE /api/comments
 * Require auth (owner) or developer. Delete comment.
 * Query param: ?id=commentId
 */
export async function DELETE(request: NextRequest) {
  try {
    const decoded = await verifyAuth(request);
    if (!decoded) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'معرف التعليق مطلوب' }, { status: 400 });
    }

    const existingComment = await db.comment.findUnique({
      where: { id },
    });

    if (!existingComment) {
      return NextResponse.json({ error: 'التعليق غير موجود' }, { status: 404 });
    }

    // Only comment owner or developer can delete
    if (existingComment.userId !== decoded.id && decoded.role !== 'DEVELOPER') {
      return NextResponse.json({ error: 'غير مصرح - يمكنك حذف تعليقاتك فقط' }, { status: 403 });
    }

    await db.comment.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
