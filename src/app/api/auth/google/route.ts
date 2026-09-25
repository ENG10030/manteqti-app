import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { sign } from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/auth";

// ============================================================
// تسجيل الدخول / إنشاء حساب عبر جوجل (Google Identity Services)
// ------------------------------------------------------------
// 1) الواجهة تحمّل زر جوجل الرسمي وتحصل على ID Token (credential)
// 2) هنا نتحقق من التوكن مع جوجل مباشرة (tokeninfo endpoint)
// 3) لو المستخدم موجود → دخول عادي (بنفس القواعد: محظور/قيد مراجعة)
//    لو جديد → إنشاء حساب مؤكد البريد تلقائياً (emailVerified=true)
// 4) إصدار نفس كوكي auth-token المستخدم في بقية الموقع
//
// متطلبات التشغيل (بيئة الإنتاج):
//   NEXT_PUBLIC_GOOGLE_CLIENT_ID  ← من Google Cloud Console (OAuth 2.0 Client ID)
//   والنطاق مسجل في Authorized JavaScript origins
// ============================================================

// Rate limiting بسيط
const googleRateLimit = new Map<string, { count: number; windowStart: number }>();
const MAX_REQUESTS = 15;
const WINDOW_MS = 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = googleRateLimit.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    googleRateLimit.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= MAX_REQUESTS) return false;
  entry.count += 1;
  return true;
}

type GoogleTokenInfo = {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
  exp?: string;
  error_description?: string;
};

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json({ error: "طلبات كثيرة. يرجى المحاولة بعد دقيقة" }, { status: 429 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: "تسجيل الدخول بجوجل غير مُفعّل بعد. أضف NEXT_PUBLIC_GOOGLE_CLIENT_ID في إعدادات البيئة" },
        { status: 501 }
      );
    }

    const body = await request.json();
    const credential = String(body.credential || "");
    if (!credential || credential.length > 5000) {
      return NextResponse.json({ error: "بيانات جوجل غير صالحة" }, { status: 400 });
    }

    // ✅ التحقق من التوكن مع خوادم جوجل مباشرة
    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      { cache: 'no-store' }
    );
    if (!verifyRes.ok) {
      return NextResponse.json({ error: "فشل التحقق من حساب جوجل. حاول مرة أخرى" }, { status: 401 });
    }
    const info = (await verifyRes.json()) as GoogleTokenInfo;

    // التحقق من أن التوكن صادر لهذا التطبيق بالذات
    if (info.aud !== clientId) {
      return NextResponse.json({ error: "حساب جوجل غير مطابق للتطبيق" }, { status: 401 });
    }
    // انتهاء الصلاحية
    if (info.exp && Number(info.exp) * 1000 < Date.now()) {
      return NextResponse.json({ error: "انتهت صلاحية جلسة جوجل. حاول مرة أخرى" }, { status: 401 });
    }
    const email = String(info.email || "").toLowerCase().trim();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "حساب جوجل لا يحتوي بريداً إلكترونياً" }, { status: 400 });
    }
    const emailVerified = info.email_verified === true || info.email_verified === "true";
    if (!emailVerified) {
      return NextResponse.json({ error: "بريد حساب جوجل غير مؤكد" }, { status: 403 });
    }

    // ===== مستخدم موجود؟ =====
    let user = await db.user.findFirst({ where: { identifier: email } });

    if (!user) {
      // إنشاء حساب جديد — البريد مؤكد من جوجل تلقائياً
      const randomPassword = bcrypt.genSaltSync(12) + cryptoRandom();
      const hashed = await bcrypt.hash(randomPassword, 12);
      const name = (info.name || email.split("@")[0]).replace(/<[^>]*>/g, "").trim().slice(0, 60) || "مستخدم";
      try {
        user = await db.user.create({
          data: {
            identifier: email,
            email,
            name,
            password: hashed,
            role: "user",
            emailVerified: true, // ✅ جوجل أكد البريد بالفعل
            isApproved: true,
          },
        });
      } catch (createErr: any) {
        // سباق نادر: مستخدم اتنشأ بنفس اللحظة → نحاول نجيبه
        user = await db.user.findFirst({ where: { identifier: email } });
        if (!user) throw createErr;
      }
    }

    // نفس قواعد الدخول العادي
    if (user.isBlocked) {
      return NextResponse.json({
        error: "تم حظر حسابك. يرجى التواصل مع الإدارة",
        errorCode: "ACCOUNT_BLOCKED",
        blockReason: user.blockReason,
      }, { status: 403 });
    }
    if (user.isApproved === false) {
      return NextResponse.json({
        error: "حسابك قيد المراجعة. يرجى الانتظار حتى يتم تأكيد حسابك من قبل الإدارة",
        errorCode: "ACCOUNT_PENDING",
      }, { status: 403 });
    }

    const token = sign(
      { userId: user.id, identifier: user.identifier, role: user.role },
      JWT_SECRET!,
      { expiresIn: "7d" }
    );

    const response = NextResponse.json({
      message: "تم تسجيل الدخول بنجاح",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        identifier: user.identifier,
        role: user.role,
        isApproved: user.isApproved,
        emailVerified: user.emailVerified,
      },
    });

    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Google auth error:", error);
    return NextResponse.json({ error: "حدث خطأ أثناء تسجيل الدخول بجوجل" }, { status: 500 });
  }
}

function cryptoRandom(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
