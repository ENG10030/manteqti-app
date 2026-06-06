import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from 'crypto';
import { JWT_SECRET } from "@/lib/auth";
import { sendOTPEmail } from "@/lib/email";

// Rate limiting for registration (in-memory)
const registerCounts = new Map<string, { count: number; lastRequest: number }>();
const MAX_REGISTER_REQUESTS = 3; // max 3 registrations per 10 minutes per IP
const REGISTER_WINDOW = 10 * 60 * 1000;

export async function POST(request: Request) {
  try {
    // Rate limit by IP
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const now = Date.now();
    const regCount = registerCounts.get(clientIp);
    if (regCount) {
      if (now - regCount.lastRequest < REGISTER_WINDOW) {
        if (regCount.count >= MAX_REGISTER_REQUESTS) {
          return NextResponse.json({ error: "طلبات كثيرة. يرجى المحاولة بعد 10 دقائق" }, { status: 429 });
        }
        regCount.count += 1;
        regCount.lastRequest = now;
      } else {
        registerCounts.set(clientIp, { count: 1, lastRequest: now });
      }
    } else {
      registerCounts.set(clientIp, { count: 1, lastRequest: now });
    }

    const body = await request.json();
    const { name, email, identifier, password, phone } = body;

    const userEmail = (email || identifier || "").toLowerCase().trim();

    if (!name || !userEmail || !password) {
      return NextResponse.json({ error: "الاسم والبريد الإلكتروني وكلمة المرور مطلوبون" }, { status: 400 });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      return NextResponse.json({ error: "صيغة البريد الإلكتروني غير صحيحة" }, { status: 400 });
    }

    // Input length validation
    if (userEmail.length > 254) {
      return NextResponse.json({ error: "البريد الإلكتروني طويل جداً" }, { status: 400 });
    }
    if (name.trim().length > 100) {
      return NextResponse.json({ error: "الاسم طويل جداً" }, { status: 400 });
    }
    if (password.length > 128) {
      return NextResponse.json({ error: "كلمة المرور طويلة جداً" }, { status: 400 });
    }
    if (phone && phone.length > 20) {
      return NextResponse.json({ error: "رقم الهاتف طويل جداً" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" }, { status: 400 });
    }

    if (name.trim().length < 2) {
      return NextResponse.json({ error: "الاسم يجب أن يكون حرفين على الأقل" }, { status: 400 });
    }

    const existingUser = await db.user.findUnique({
      where: { identifier: userEmail },
    });

    if (existingUser) {
      return NextResponse.json({ error: "البريد الإلكتروني مستخدم بالفعل" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate 6-digit OTP for email verification (v219)
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    const hashedOtp = await bcrypt.hash(otp, 10);

    // ⚠️ SECURITY FIX: Create user with emailVerified: false
    // User CANNOT use the account until they verify their email via OTP
    const user = await db.user.create({
      data: {
        name: name.trim(),
        email: userEmail,
        password: hashedPassword,
        phone: phone || null,
        identifier: userEmail,
        role: "USER",
        isApproved: true,
        emailVerified: false, // ⛔ NOT verified until OTP confirmed
        otp: hashedOtp,
        otpExpires,
      },
    });

    // Send OTP email for verification
    if (!process.env.RESEND_API_KEY) {
      console.warn('⚠️ RESEND_API_KEY is not set. OTP email will NOT be sent. User:', userEmail);
    }
    
    try {
      await sendOTPEmail({ to: userEmail, otp, name: name.trim() });
    } catch {
      // If email fails, still create account but log error
      console.error('Failed to send OTP email during registration');
    }

    return NextResponse.json({
      message: "تم إنشاء الحساب. يرجى تأكيد بريدك الإلكتروني بالرمز المرسل",
      requiresVerification: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        identifier: user.identifier,
        role: user.role,
        emailVerified: false,
      },
    });

  } catch (error) {
    return NextResponse.json({ error: "حدث خطأ أثناء إنشاء الحساب" }, { status: 500 });
  }
}
