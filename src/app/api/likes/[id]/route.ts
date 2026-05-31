import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/auth';

export const dynamic = "force-dynamic";



// حذف إعجاب (بواسطة ID الإعجاب أو apartmentId + userId)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }
    let decoded: any;
    try {
      decoded = verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    } catch {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const tokenUserId = decoded.userId;
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const apartmentId = searchParams.get('apartmentId');
    const userId = searchParams.get('userId');

    // إذا كان ID هو apartmentId وتم تمرير userId
    if (apartmentId && userId) {
      // Verify userId matches token
      if (userId !== tokenUserId && decoded.role !== 'DEVELOPER') {
        return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
      }
      await db.like.deleteMany({
        where: {
          apartmentId: id,
          userId,
        }
      });
    } else {
      // حذف بواسطة ID الإعجاب - يجب التحقق من الملكية
      const like = await db.like.findUnique({ where: { id } });
      if (!like) {
        return NextResponse.json({ error: 'الإعجاب غير موجود' }, { status: 404 });
      }
      if (like.userId !== tokenUserId && decoded.role !== 'DEVELOPER') {
        return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
      }
      await db.like.delete({ where: { id } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting like:', error);
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 });
  }
}
