import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sign } from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { sendWelcomeEmail } from '@/lib/email';
import { checkRateLimit, recordFailedAttempt } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const { identifier, otp, code } = await request.json();

    // Accept either 'otp' or 'code' field
    const otpCode = otp || code;

    if (!identifier || !otpCode) {
      return NextResponse.json({ error: 'البريد الإلكتروني والرمز مطلوبان' }, { status: 400 });
    }

    const normalizedIdentifier = identifier.toLowerCase().trim();

    // ⛔ SECURITY: محاولات الرمز الغلط محسوبة في قاعدة البيانات — 5 محاولات / 15 دقيقة لكل بريد
    // (كانت في الذاكرة = بتتصفّر مع كل instance على serverless = brute force عملي)
    const allowed = await checkRateLimit("verify-otp", "email", normalizedIdentifier, 5, 15 * 60);
    if (!allowed) {
      return NextResponse.json({ 
        error: 'تم تجاوز عدد المحاولات المسموح. يرجى المحاولة بعد 15 دقيقة',
        tooManyAttempts: true 
      }, { status: 429 });
    }

    // Find user by identifier
    const user = await db.user.findFirst({
      where: {
        OR: [
          { identifier: normalizedIdentifier },
          { email: normalizedIdentifier }
        ]
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'البريد الإلكتروني أو الرمز غير صحيح' }, { status: 400 });
    }

    // Check expiry BEFORE checking OTP value
    if (!user.otpExpires || user.otpExpires < new Date()) {
      return NextResponse.json({ error: 'انتهت صلاحية الرمز' }, { status: 400 });
    }

    // ⚠️ FIX: Check if OTP is null before bcrypt.compare (prevents crash)
    if (!user.otp) {
      return NextResponse.json({ error: 'لا يوجد رمز تحقق. يرجى طلب رمز جديد' }, { status: 400 });
    }

    // Use bcrypt.compare for OTP verification (since we now hash it)
    const isOtpValid = await bcrypt.compare(otpCode, user.otp);

    if (!isOtpValid) {
      // ⛔ SECURITY: سجّل المحاولة الفاشلة في DB
      await recordFailedAttempt("verify-otp", "email", normalizedIdentifier, request, "wrong otp");
      const remainingCount = await db.operationLog.count({
        where: { action: 'rate-limit:verify-otp', entityType: 'email', entityId: normalizedIdentifier, createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
      }).catch(() => 0);
      const remaining = Math.max(0, 5 - remainingCount);

      return NextResponse.json({ 
        error: `رمز التأكيد غير صحيح. متبقي ${remaining} محاول${remaining === 1 ? 'ة' : 'ات'}`,
        remainingAttempts: remaining 
      }, { status: 400 });
    }

    // Mark email as verified and clear OTP
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        otp: null,
        otpExpires: null,
        emailVerified: true,
      }
    });

    // Generate JWT token and set auth-token cookie (same as login)
    const token = sign(
      { userId: updatedUser.id, identifier: updatedUser.identifier, role: updatedUser.role },
      JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // 📧 Send welcome email after successful verification (fire-and-forget)
    const userEmail = updatedUser.email || normalizedIdentifier;
    sendWelcomeEmail({ to: userEmail, name: updatedUser.name }).catch((err) => {
      console.error('Failed to send welcome email after OTP verification:', err?.message);
    });

    const response = NextResponse.json({
      message: 'تم تأكيد البريد الإلكتروني بنجاح',
      user: {
        id: updatedUser.id,
        identifier: updatedUser.identifier,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        emailVerified: true,
        isApproved: updatedUser.isApproved, // ⚠️ FIX: Include isApproved in response
      }
    });

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'فشل في التحقق من الرمز' }, { status: 500 });
  }
}
