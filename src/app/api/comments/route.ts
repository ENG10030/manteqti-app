import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApprovedUser } from '@/lib/auth-middleware';

// تسجيل إجراء بشكل اختياري - لا يوقف العملية لو فشل
async function logAction(data: { commentId: string; action: string; performedBy: string; details: string }) {
  try {
    await db.commentActionLog.create({ data });
  } catch (error) {
    console.error('Failed to log comment action (non-blocking):', error);
  }
}

// جلب التعليقات
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apartmentId = searchParams.get('apartmentId');
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const includeLogs = searchParams.get('includeLogs') === 'true';

    const where: Record<string, unknown> = {};
    if (apartmentId) where.apartmentId = apartmentId;
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const comments = await db.comment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            // ⛔ SECURITY: Do NOT expose identifier (email) in public comments
          }
        },
        ...(includeLogs ? {
          actionLogs: {
            orderBy: { createdAt: 'desc' },
          }
        } : {})
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// إضافة تعليق جديد
export async function POST(request: NextRequest) {
  try {
    const { auth, errorResponse } = await requireApprovedUser(request);
    if (errorResponse || !auth) return errorResponse!;

    const body = await request.json();
    const { apartmentId, content } = body;

    if (!apartmentId || !content) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
    }

    const isDeveloper = auth.role === 'DEVELOPER';
    const userId = auth.userId;

    const comment = await db.comment.create({
      data: {
        apartmentId,
        userId,
        content,
        status: isDeveloper ? 'approved' : 'pending',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            // ⛔ SECURITY: Do NOT expose identifier (email) in responses
          }
        }
      }
    });

    // Log the action (non-blocking)
    logAction({
      commentId: comment.id,
      action: isDeveloper ? 'created_approved' : 'created_pending',
      performedBy: userId,
      details: isDeveloper ? 'المطور أنشأ ونشر التعليق مباشرة' : 'تم إنشاء تعليق بانتظار موافقة المطور',
    });

    return NextResponse.json({ 
      success: true, 
      comment,
      message: isDeveloper ? 'تم نشر التعليق مباشرة' : 'تم إرسال تعليقك وهو في انتظار موافقة المطور' 
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
