import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verify } from 'jsonwebtoken';
import { runAutoArchive } from '@/lib/auto-archive';

// أرشفة تلقائية بعد 48 ساعة للحالات النهائية (تم البيع / تم التأجير / غير متاح)
// يمكن استدعاؤه بـ:
//   1) Vercel Cron (يُرسل Authorization: Bearer CRON_SECRET تلقائياً)
//   2) أي جدولة خارجية بنفس الطريقة
//   3) جلسة مطور مسجّل الدخول (زر "تشغيل الأرشفة الآن" في لوحة المطور)

const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com';

async function isAuthorized(request: NextRequest): Promise<boolean> {
  // 1) Cron secret (يفشل مغلقاً إذا لم يُضبط)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  // 2) جلسة مطور
  try {
    const cookieToken = request.cookies.get('auth-token')?.value;
    if (!cookieToken || !process.env.JWT_SECRET) return false;
    const decoded = verify(cookieToken, process.env.JWT_SECRET) as unknown as { userId: string; role?: string; identifier?: string };
    if (decoded.role === 'DEVELOPER' || decoded.identifier === DEVELOPER_EMAIL) return true;
    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true, identifier: true },
    });
    return user?.role === 'DEVELOPER' || user?.identifier === DEVELOPER_EMAIL;
  } catch {
    return false;
  }
}

async function handle(request: NextRequest) {
  try {
    if (!(await isAuthorized(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await runAutoArchive();

    return NextResponse.json({
      success: true,
      message: `تمت الأرشفة التلقائية - ${result.archivedCount} عقار`,
      ...result,
    });
  } catch (error) {
    console.error('Error in auto-archive cron:', error);
    return NextResponse.json(
      { success: false, error: 'فشل تشغيل الأرشفة التلقائية' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
