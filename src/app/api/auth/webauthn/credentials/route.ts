import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-middleware';

// ============================================================
// إدارة البصمات المسجلة لحساب المستخدم
// GET: قائمة البصمات | DELETE: حذف بصمة { id }
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const { auth, errorResponse } = await getAuthContext(request);
    if (errorResponse || !auth) return errorResponse!;

    const credentials = await db.webAuthnCredential.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        deviceType: true,
        backedUp: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });

    return NextResponse.json({ credentials, count: credentials.length });
  } catch (error) {
    console.error('WebAuthn credentials list error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب البصمات' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { auth, errorResponse } = await getAuthContext(request);
    if (errorResponse || !auth) return errorResponse!;

    const body = await request.json().catch(() => ({}));
    const id = typeof body?.id === 'string' ? body.id : '';
    if (!id) {
      return NextResponse.json({ error: 'معرف البصمة مطلوب' }, { status: 400 });
    }

    const credential = await db.webAuthnCredential.findUnique({ where: { id } });
    if (!credential || credential.userId !== auth.userId) {
      return NextResponse.json({ error: 'البصمة غير موجودة' }, { status: 404 });
    }

    await db.webAuthnCredential.delete({ where: { id } });

    return NextResponse.json({
      message: `تم حذف "${credential.name || 'البصمة'}" — لن تعمل للدخول بعد الآن`,
    });
  } catch (error) {
    console.error('WebAuthn credential delete error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف البصمة' }, { status: 500 });
  }
}
