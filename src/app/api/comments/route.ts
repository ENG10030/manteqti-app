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

// التحقق من هوية العارض (اختياري — الزائر يبقى null)
async function getViewer(request: NextRequest) {
  try {
    const { verify } = await import('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) return null;
    const cookieHeader = request.headers.get('cookie');
    const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, '&') || '');
    const token = cookies.get('auth-token');
    if (!token) return null;
    const decoded = verify(token, JWT_SECRET) as unknown as { userId: string };
    return await db.user.findUnique({ where: { id: decoded.userId }, select: { id: true, role: true } });
  } catch {
    return null;
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

    const viewer = await getViewer(request);
    const isDeveloper = viewer?.role === 'DEVELOPER';

    let includeLogsRequested = includeLogs && isDeveloper;
    const where: Record<string, unknown> = {};
    if (apartmentId) where.apartmentId = apartmentId;

    // ⛔ SECURITY: فلترة الحالات غير المعتمدة (pending/rejected/all...) للمطور فقط —
    // كانت مكشوفة للعامة (تعليقات غير مراجعة + سجل إجراءات الإدارة)
    if (status && status !== 'approved') {
      if (!isDeveloper) {
        return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
      }
      if (status !== 'all') where.status = status; // 'all' = كل الحالات
    } else if (!status) {
      if (viewer) {
        // المسجل دخوله يشوف المعتمد + تعليقاته هو (حتى لو معلقة) — الواجهة مبنية على كده
        where.OR = [{ status: 'approved' }, { userId: viewer.id }];
      } else {
        where.status = 'approved';
      }
    }
    // فلترة بحسب مستخدم معين = كشف تاريخ تعليقاته → للمطور فقط
    if (userId && !isDeveloper) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }
    if (userId) where.userId = userId;
    // سجل إجراءات الإدارة → للمطور فقط
    if (includeLogs && !isDeveloper) {
      includeLogsRequested = false;
    }

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
        ...(includeLogsRequested ? {
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
    const { apartmentId } = body;
    // ⛔ SECURITY: حد طول التعليق + تعقيم أساسي (كان بلا حد = تضخيم DB)
    const content = typeof body.content === 'string' ? body.content.trim().slice(0, 2000) : '';

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
