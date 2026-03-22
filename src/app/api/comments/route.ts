import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// جلب التعليقات
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apartmentId = searchParams.get('apartmentId');
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');

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
            identifier: true,
          }
        },
        apartment: {
          select: {
            id: true,
            title: true,
          }
        }
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
    const body = await request.json();
    const { apartmentId, userId, content, isDeveloper, status } = body;

    if (!apartmentId || !content) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 });
    }

    let finalUserId = userId;
    let commentStatus = status || 'pending';

    // إذا كان المطور يعلق
    if (isDeveloper || userId === 'developer') {
      // البحث عن مستخدم المطور أو إنشاؤه
      let developerUser = await db.user.findUnique({
        where: { identifier: 'developer' }
      });

      if (!developerUser) {
        // إنشاء مستخدم للمطور
        developerUser = await db.user.create({
          data: {
            identifier: 'developer',
            name: 'المطور',
            password: 'developer_internal'
          }
        });
      }

      finalUserId = developerUser.id;
      commentStatus = 'approved'; // تعليقات المطور تُنشر مباشرة
    }

    const comment = await db.comment.create({
      data: {
        apartmentId,
        userId: finalUserId,
        content,
        status: commentStatus,
        approvedBy: isDeveloper ? 'developer' : null,
        approvedAt: isDeveloper ? new Date() : null,
      },
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
      message: isDeveloper ? 'تم نشر التعليق مباشرة' : 'تم إرسال تعليقك وهو في انتظار موافقة المطور' 
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
