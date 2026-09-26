import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthContext } from '@/lib/auth-middleware';
import { verifyRegistrationResponse, RegistrationResponseJSON } from '@simplewebauthn/server';
import { getRPInfo, readChallengeCookie, clearChallengeCookie, keyToBase64URL } from '@/lib/webauthn';

// ============================================================
// تأكيد تسجيل البصمة — يتحقق من التوقيع ويخزن المفتاح العام فقط
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const { auth, errorResponse } = await getAuthContext(request);
    if (errorResponse || !auth) return errorResponse!;

    const challengeData = readChallengeCookie(request, 'register');
    if (!challengeData) {
      return NextResponse.json(
        { error: 'انتهت صلاحية طلب تسجيل البصمة — حاول مرة أخرى' },
        { status: 400 }
      );
    }
    if (challengeData.userId && challengeData.userId !== auth.userId) {
      return NextResponse.json({ error: 'جلسة غير مطابقة — حاول مرة أخرى' }, { status: 400 });
    }

    const body = await request.json();
    const credentialResponse = body?.response as RegistrationResponseJSON | undefined;
    const deviceName = typeof body?.name === 'string' ? body.name.slice(0, 60) : undefined;
    if (!credentialResponse) {
      return NextResponse.json({ error: 'بيانات البصمة غير صالحة' }, { status: 400 });
    }

    const { rpID, origin } = getRPInfo(request);

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: credentialResponse,
        expectedChallenge: challengeData.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: false, // نسمح بأجهزة بدون بصمة (PIN) — البصمة تُطلب إن كانت متاحة
      });
    } catch {
      return NextResponse.json({ error: 'فشل التحقق من البصمة — تأكد أنك تستخدم نفس الجهاز والموقع الأصلي' }, { status: 400 });
    }

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'فشل التحقق من البصمة' }, { status: 400 });
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    // منع تسجيل نفس البصمة لحساب آخر
    const existing = await db.webAuthnCredential.findUnique({ where: { credentialId: credential.id } });
    if (existing && existing.userId !== auth.userId) {
      return NextResponse.json({ error: 'هذه البصمة مرتبطة بحساب آخر' }, { status: 400 });
    }

    if (existing) {
      await db.webAuthnCredential.update({
        where: { id: existing.id },
        data: {
          publicKey: keyToBase64URL(credential.publicKey),
          counter: credential.counter,
          transports: credential.transports?.join(',') ?? null,
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
        },
      });
    } else {
      await db.webAuthnCredential.create({
        data: {
          userId: auth.userId,
          credentialId: credential.id,
          publicKey: keyToBase64URL(credential.publicKey),
          counter: credential.counter,
          transports: credential.transports?.join(',') ?? null,
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          name: deviceName || 'بصمة مسجلة',
        },
      });
    }

    const response = NextResponse.json({
      verified: true,
      message: 'تم تفعيل الدخول بالبصمة ✅ — من دلوقتي تقدر تدخل بدون كلمة مرور',
    });
    clearChallengeCookie(response);
    return response;
  } catch (error) {
    console.error('WebAuthn register-verify error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تأكيد تسجيل البصمة' }, { status: 500 });
  }
}
