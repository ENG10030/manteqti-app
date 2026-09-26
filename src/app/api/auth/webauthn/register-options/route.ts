import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-middleware';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { getRPInfo, setChallengeCookie, RP_NAME } from '@/lib/webauthn';

// ============================================================
// خيارات تسجيل بصمة جديدة (WebAuthn) — يتطلب جلسة مسجلة
// الرد = PublicKeyCredentialCreationOptionsJSON المرسلة للمتصفح
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const { auth, errorResponse } = await getAuthContext(request);
    if (errorResponse || !auth) return errorResponse!;

    const user = await db.user.findUnique({
      where: { id: auth.userId },
      include: { webauthnCredentials: { select: { credentialId: true } } },
    });
    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    const { rpID } = getRPInfo(request);

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID,
      userID: new Uint8Array(Buffer.from(user.id, 'utf8')),
      userName: user.identifier,
      userDisplayName: user.name || user.identifier,
      attestationType: 'none',
      // استبعاد البصمات المسجلة سابقاً لنفس المستخدم
      excludeCredentials: user.webauthnCredentials.map((c) => ({ id: c.credentialId })),
      authenticatorSelection: {
        residentKey: 'preferred', // passkey قابل للاكتشاف → دخول بأي جهاز مسجل
        userVerification: 'preferred', // بصمة/Face ID لو متاحة، PIN كخيار بديل
      },
    });

    const response = NextResponse.json(options);
    setChallengeCookie(response, { challenge: options.challenge, type: 'register', userId: user.id });
    return response;
  } catch (error) {
    console.error('WebAuthn register-options error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تجهيز تسجيل البصمة' }, { status: 500 });
  }
}
