import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendOTPEmail, sendNewUserNotificationEmail } from "@/lib/email";

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

    if (password.length < 6) {
      return NextResponse.json(
        { error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" },
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
    const isDeveloper = userEmail === (process.env.DEVELOPER_EMAIL || "ahmadmamdouh10030@gmail.com");

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
        console.log(`📧 Registration OTP email result for ${userEmail}: ${JSON.stringify(emailResult)}`);
        if (!emailResult.success) {
          console.error(`❌ FAILED to send OTP to ${userEmail}: ${emailResult.error}`);
        }
      } catch (err) {
        console.error('Error sending registration OTP:', err);
      }
    }

    // Notify developer of new registration (fire-and-forget)
    if (!isDeveloper) {
      const devEmail = process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com';
      sendNewUserNotificationEmail({
        to: devEmail,
        userName: user.name,
        userEmail: userEmail,
        userPhone: phone || null,
      }).catch(err => {
        console.error('Failed to send developer notification:', err);
      });
    }

    return NextResponse.json({
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
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء إنشاء الحساب" },
      { status: 500 }
    );
  }
}
