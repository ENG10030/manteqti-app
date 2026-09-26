import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sign } from 'jsonwebtoken';
import { verifyAuthenticationResponse, AuthenticationResponseJSON } from '@simplewebauthn/server';
import { JWT_SECRET } from '@/lib/auth';
import { getRPInfo, readChallengeCookie, clearChallengeCookie, keyFromBase64URL } from '@/lib/webauthn';

// ============================================================
// تأكيد الدخول بالبصمة — نفس قواعد الدخول العادي تماماً:
// محظور / قيد المراجعة / بريد غير مؤكد + نفس كوكي الجلسة
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const challengeData = readChallengeCookie(request, 'login');
    if (!challengeData) {
      return NextResponse.json(
        { error: 'انتهت صلاحية طلب الدخول بالبصمة — حاول مرة أخرى' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const assertion = body?.response as AuthenticationResponseJSON | undefined;
    if (!assertion || !assertion.id) {
      return NextResponse.json({ error: 'بيانات البصمة غير صالحة' }, { status: 400 });
    }

    // البصمة المسجلة من الـ ID المرسل من المتصفح
    const credentialId = String(assertion.id);
    const stored = await db.webAuthnCredential.findUnique({
      where: { credentialId },
      include: { user: true },
    });
    if (!stored) {
      return NextResponse.json(
        { error: 'البصمة غير مسجلة — سجل دخولك بكلمة المرور وفعّل البصمة من قائمة حسابك' },
        { status: 400 }
      );
    }

    const { rpID, origin } = getRPInfo(request);

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: assertion,
        expectedChallenge: challengeData.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: stored.credentialId,
          publicKey: keyFromBase64URL(stored.publicKey),
          counter: stored.counter,
          transports: stored.transports ? (stored.transports.split(',') as [] ) : undefined,
        },
        requireUserVerification: false,
      });
    } catch {
      return NextResponse.json(
        { error: 'فشل التحقق من البصمة — تأكد أنك تستخدم نفس الجهاز المسجل' },
        { status: 400 }
      );
    }

    if (!verification.verified) {
      return NextResponse.json({ error: 'فشل التحقق من البصمة' }, { status: 400 });
    }

    // تحديث العداد وآخر استخدام (حماية replay)
    await db.webAuthnCredential.update({
      where: { id: stored.id },
      data: {
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      },
    });

    // ===== نفس قواعد الدخول بالكلمة السرية =====
    const user = stored.user;
    if (user.isBlocked) {
      return NextResponse.json({
        error: 'تم حظر حسابك. يرجى التواصل مع الإدارة',
        errorCode: 'ACCOUNT_BLOCKED',
        blockReason: user.blockReason,
      }, { status: 403 });
    }
    if (user.isApproved === false) {
      return NextResponse.json({
        error: 'حسابك قيد المراجعة. يرجى الانتظار حتى يتم تأكيد حسابك من قبل الإدارة',
        errorCode: 'ACCOUNT_PENDING',
      }, { status: 403 });
    }
    if (!user.emailVerified && user.role !== 'DEVELOPER') {
      return NextResponse.json({
        error: 'يجب تأكيد بريدك الإلكتروني أولاً',
        errorCode: 'EMAIL_NOT_VERIFIED',
        identifier: user.identifier,
      }, { status: 403 });
    }

    const token = sign(
      { userId: user.id, identifier: user.identifier, role: user.role },
      JWT_SECRET!,
      { expiresIn: '7d' }
    );

    const response = NextResponse.json({
      message: 'تم تسجيل الدخول بالبصمة بنجاح',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        identifier: user.identifier,
        role: user.role,
        isApproved: user.isApproved,
        emailVerified: user.emailVerified,
        walletBalance: user.walletBalance,
      },
    });
    clearChallengeCookie(response);
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return response;
  } catch (error) {
    console.error('WebAuthn login-verify error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل الدخول بالبصمة' }, { status: 500 });
  }
}
