import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// حظر مستخدم
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, reason } = body;

    if (!userId) {
      return NextResponse.json({ error: 'مطلوب معرف المستخدم' }, { status: 400 });
    }

    // تحديث حالة المستخدم
    await db.user.update({
      where: { id: userId },
      data: { isBlocked: true }
    });

    // إنشاء سجل الحظر
    const blockRecord = await db.blockedUser.create({
      data: {
        userId,
        reason: reason || 'تم الحظر من قبل المطور'
      }
    });

    return NextResponse.json({ success: true, message: 'تم حظر المستخدم', blockRecord });
  } catch (error) {
    console.error('Error blocking user:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// إلغاء حظر مستخدم
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'مطلوب معرف المستخدم' }, { status: 400 });
    }

    // تحديث حالة المستخدم
    await db.user.update({
      where: { id: userId },
      data: { isBlocked: false }
    });

    // حذف سجل الحظر
    await db.blockedUser.deleteMany({
      where: { userId }
    });

    return NextResponse.json({ success: true, message: 'تم إلغاء حظر المستخدم' });
  } catch (error) {
    console.error('Error unblocking user:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// جلب قائمة المحظورين
export async function GET() {
  try {
    const blockedUsers = await db.blockedUser.findMany({
      include: {
        user: {
          select: { id: true, name: true, identifier: true }
        }
      },
      orderBy: { blockedAt: 'desc' }
    });

    return NextResponse.json(blockedUsers);
  } catch (error) {
    console.error('Error fetching blocked users:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
