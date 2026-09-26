import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getRPInfo, setChallengeCookie } from '@/lib/webauthn';

// ============================================================
// خيارات الدخول بالبصمة — عام (بدون جلسة)
// - مع identifier: يجهز البصمات المسجلة لهذا الحساب تحديداً
// - بدون identifier: دخول discoverable (أي بصمة مسجلة على الجهاز)
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const identifier = typeof body?.identifier === 'string' ? body.identifier.toLowerCase().trim().slice(0, 254) : '';

    const { rpID } = getRPInfo(request);

    let allowCredentials: { id: string }[] = [];
    let available = true;

    if (identifier) {
      const user = await db.user.findFirst({
        where: { OR: [{ identifier }, { phone: identifier }] },
        include: { webauthnCredentials: { select: { credentialId: true } } },
      });
      if (!user || user.webauthnCredentials.length === 0) {
        // مفيش بصمة للحساب ده — الواجهة تعرض رسالة إرشادية
        return NextResponse.json({ available: false });
      }
      allowCredentials = user.webauthnCredentials.map((c) => ({ id: c.credentialId }));
    }

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
      allowCredentials,
    });

    const response = NextResponse.json({ available: true, options });
    setChallengeCookie(response, { challenge: options.challenge, type: 'login' });
    return response;
  } catch (error) {
    console.error('WebAuthn login-options error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تجهيز الدخول بالبصمة' }, { status: 500 });
  }
}
