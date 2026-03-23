import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// حظر مستخدم وإخفاء عقاراته
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, reason, hideApartments = true } = body;

    if (!userId) {
      return NextResponse.json({ error: 'مطلوب معرف المستخدم' }, { status: 400 });
    }

    // التحقق من وجود المستخدم
    const user = await db.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
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
        reason: reason || 'تم الحظر من قبل المطور',
        blockedBy: 'developer'
      }
    });

    // إخفاء جميع عقارات المستخدم
    let hiddenApartmentsCount = 0;
    if (hideApartments) {
      const result = await db.apartment.updateMany({
        where: { createdBy: userId },
        data: { status: 'hidden' }
      });
      hiddenApartmentsCount = result.count;
    }

    return NextResponse.json({ 
      success: true, 
      message: 'تم حظر المستخدم وإخفاء عقاراته',
      blockRecord,
      hiddenApartments: hiddenApartmentsCount
    });
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
    const restoreApartments = searchParams.get('restoreApartments') === 'true';

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

    // استعادة عقارات المستخدم إذا طُلب
    let restoredApartmentsCount = 0;
    if (restoreApartments) {
      const result = await db.apartment.updateMany({
        where: { 
          createdBy: userId,
          status: 'hidden'
        },
        data: { status: 'pending' } // تعيين كـ pending للمراجعة مرة أخرى
      });
      restoredApartmentsCount = result.count;
    }

    return NextResponse.json({ 
      success: true, 
      message: 'تم إلغاء حظر المستخدم',
      restoredApartments: restoredApartmentsCount
    });
  } catch (error) {
    console.error('Error unblocking user:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// جلب قائمة المحظورين
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeApartments = searchParams.get('includeApartments') === 'true';

    const blockedUsers = await db.blockedUser.findMany({
      include: {
        user: {
          select: { id: true, name: true, identifier: true, phone: true, email: true }
        }
      },
      orderBy: { blockedAt: 'desc' }
    });

    // إضافة عدد العقارات المخفية لكل مستخدم
    let result = blockedUsers;
    if (includeApartments) {
      result = await Promise.all(
        blockedUsers.map(async (blocked) => {
          const apartmentCount = await db.apartment.count({
            where: { 
              createdBy: blocked.userId,
              status: 'hidden'
            }
          });
          return {
            ...blocked,
            hiddenApartmentsCount: apartmentCount
          };
        })
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching blocked users:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}

// استعادة عقارات محددة لمستخدم محظور
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, apartmentIds, action } = body;

    if (!userId) {
      return NextResponse.json({ error: 'مطلوب معرف المستخدم' }, { status: 400 });
    }

    if (action === 'restore') {
      // استعادة عقارات محددة
      if (apartmentIds && apartmentIds.length > 0) {
        await db.apartment.updateMany({
          where: { 
            id: { in: apartmentIds },
            createdBy: userId
          },
          data: { status: 'pending' }
        });
        return NextResponse.json({ success: true, message: 'تم استعادة العقارات المحددة' });
      } else {
        // استعادة جميع العقارات
        const result = await db.apartment.updateMany({
          where: { 
            createdBy: userId,
            status: 'hidden'
          },
          data: { status: 'pending' }
        });
        return NextResponse.json({ 
          success: true, 
          message: 'تم استعادة جميع العقارات',
          count: result.count 
        });
      }
    } else if (action === 'delete') {
      // حذف عقارات محددة
      if (apartmentIds && apartmentIds.length > 0) {
        await db.apartment.deleteMany({
          where: { 
            id: { in: apartmentIds },
            createdBy: userId
          }
        });
        return NextResponse.json({ success: true, message: 'تم حذف العقارات المحددة' });
      } else {
        // حذف جميع العقارات
        const result = await db.apartment.deleteMany({
          where: { 
            createdBy: userId,
            status: 'hidden'
          }
        });
        return NextResponse.json({ 
          success: true, 
          message: 'تم حذف جميع العقارات',
          count: result.count 
        });
      }
    }

    return NextResponse.json({ error: 'إجراء غير صحيح' }, { status: 400 });
  } catch (error) {
    console.error('Error managing blocked user apartments:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
