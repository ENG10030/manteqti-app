import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sign } from "jsonwebtoken";
import { sendOTPEmail, sendNewUserNotificationEmail } from "@/lib/email";
import { JWT_SECRET } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// قائمة نطاقات البريد المؤقتة المحظورة
const BLOCKED_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', 'guerrillamailblock.com', 'sharklasers.com',
  'guerrillamail.net', 'grr.la', 'dispostable.com', 'trashmail.com', 'trashmail.io',
  'tempmail.com', 'tempmail.io', 'temp-mail.org', 'throwaway.email', 'fakeinbox.com',
  'maildrop.cc', 'mailnesia.com', 'mailcatch.com', 'yopmail.com', 'yopmail.fr',
  'jetable.org', 'mailforspam.com', 'spamgourmet.com', 'mohmal.com', 'tempail.com',
  'emailondeck.com', 'crazymailing.com', 'trashymail.com', 'filzmail.com',
  'incognitomail.org', 'mailnull.com', 'tempinbox.com', 'binkmail.com',
  'safetymail.info', 'spamavert.com', 'mintemail.com', 'mailtothis.com',
  'dispostable.com', 'inboxkitten.com',
  '10minutemail.com', '10minutemail.net', 'tempmailaddress.com',
  'example.com', 'example.org', 'test.com', 'fake.com', 'invalid.com',
  'notreal.com', 'nomail.com', 'noemail.com', 'nowhere.com',
];

function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return true;
  if (BLOCKED_DOMAINS.includes(domain)) return true;
  const suspiciousKeywords = ['temp', 'trash', 'spam', 'fake', 'disposable', 'throw', 'burner', 'phish'];
  for (const keyword of suspiciousKeywords) {
    if (domain.includes(keyword)) return true;
  }
  return false;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) return false;
  const domain = email.split('@')[1];
  if (!domain) return false;
  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2) return false;
  if (isDisposableEmail(email)) return false;
  return true;
}

export async function POST(request: Request) {
  try {
    // Rate limiting: 3 requests per 15 minutes per IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const allowed = await checkRateLimit("register", "ip", ip, 3, 15 * 60);
    if (!allowed) {
      return NextResponse.json({ error: "طلبات كثيرة. حاول بعد 15 دقيقة" }, { status: 429 });
    }

    const body = await request.json();
    const { name, email, identifier, password, phone } = body;

    const userEmail = (email || identifier || "").toLowerCase().trim();

    if (!name || !userEmail || !password) {
      return NextResponse.json(
        { error: "الاسم والبريد الإلكتروني وكلمة المرور مطلوبون" },
        { status: 400 }
      );
    }

    if (!isValidEmail(userEmail)) {
      return NextResponse.json(
        { error: "صيغة البريد الإلكتروني غير صحيحة أو النطاق غير مسموح به. يرجى استخدام بريد إلكتروني حقيقي (Gmail, Yahoo, Hotmail, إلخ)" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حروف وأرقام" },
        { status: 400 }
      );
    }

    // 🔒 Check password strength
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
      return NextResponse.json(
        { error: "كلمة المرور يجب أن تحتوي على حروف وأرقام" },
        { status: 400 }
      );
    }

    if (name.trim().length < 2) {
      return NextResponse.json(
        { error: "الاسم يجب أن يكون حرفين على الأقل" },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findUnique({
      where: { identifier: userEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "البريد الإلكتروني مستخدم بالفعل" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const isDeveloper = userEmail === process.env.DEVELOPER_EMAIL;

    // Generate OTP for email verification
    const otp = isDeveloper ? null : crypto.randomInt(100000, 999999).toString();
    const otpExpires = isDeveloper ? null : new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    const user = await db.user.create({
      data: {
        name,
        email: userEmail,
        password: hashedPassword,
        phone: phone || null,
        identifier: userEmail,
        role: isDeveloper ? "DEVELOPER" : "USER",
        isApproved: isDeveloper,
        emailVerified: isDeveloper,
        otp,
        otpExpires,
      },
    });

    // Log registration in OperationLog
    try {
      await db.operationLog.create({
        data: {
          action: isDeveloper ? "DEVELOPER_AUTO_REGISTER" : "USER_REGISTER",
          entityType: "User",
          entityId: user.id,
          details: JSON.stringify({
            userName: user.name,
            email: user.email,
            phone: phone || null,
            needsApproval: !isDeveloper,
            otpSent: !isDeveloper,
          }),
          userId: user.id,
        },
      });
    } catch {}

    // Send OTP email for non-developer users
    if (!isDeveloper && otp) {
      try {
        const emailResult = await sendOTPEmail({ to: userEmail, otp, name: user.name });
        console.log(`📧 Registration OTP email result: ${JSON.stringify(emailResult)}`);
      } catch (err) {
        console.error('Error sending registration OTP:', err);
      }
    }

    // Send notification email to developer about new registration
    if (!isDeveloper) {
      const DEVELOPER_EMAIL = process.env.DEVELOPER_EMAIL;
      if (DEVELOPER_EMAIL) {
        try {
          await sendNewUserNotificationEmail({
            to: DEVELOPER_EMAIL,
            userName: user.name,
            userEmail: user.email || userEmail,
            userPhone: phone || null,
          });
        } catch (err) {
          console.error('Error sending developer notification:', err);
        }
      } else {
        console.error('DEVELOPER_EMAIL not set, skipping notification');
      }
    }

    const response = NextResponse.json({
      message: isDeveloper ? "تم إنشاء الحساب بنجاح" : "تم إنشاء الحساب بنجاح. يرجى تأكيد البريد الإلكتروني",
      emailVerificationRequired: !isDeveloper,
      email: userEmail,
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

    // 🔑 Set auth-token cookie for developer (no OTP needed) and auto-approved users
    // Non-developer users will get the cookie after OTP verification
    if (isDeveloper) {
      const token = sign(
        { userId: user.id, identifier: user.identifier, role: user.role, name: user.name, email: user.email, isApproved: true, emailVerified: true, isBlocked: false },
        JWT_SECRET,
        { expiresIn: "30d", algorithm: "HS256" }
      );
      response.cookies.set("auth-token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }

    return response;
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء إنشاء الحساب" },
      { status: 500 }
    );
  }
}
