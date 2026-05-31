import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, recordFailedAttempt } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // 🔒 Rate limiting — 5 submissions per 15 minutes per IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const allowed = await checkRateLimit("contact", "ip", ip, 5, 15 * 60);
    if (!allowed) {
      return NextResponse.json(
        { error: 'طلبات كثيرة جداً، حاول بعد 15 دقيقة' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { name, email, message } = body;

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      await recordFailedAttempt("contact", "ip", ip, request, "Invalid name");
      return NextResponse.json(
        { error: 'يجب أن يكون الاسم حرفين على الأقل' },
        { status: 400 }
      );
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
      await recordFailedAttempt("contact", "ip", ip, request, "Invalid email");
      return NextResponse.json(
        { error: 'يرجى إدخال بريد إلكتروني صحيح' },
        { status: 400 }
      );
    }

    // Validate message
    if (!message || typeof message !== 'string' || message.trim().length < 10) {
      await recordFailedAttempt("contact", "ip", ip, request, "Invalid message");
      return NextResponse.json(
        { error: 'يجب أن تكون الرسالة 10 أحرف على الأقل' },
        { status: 400 }
      );
    }

    // Sanitize input — prevent XSS
    const sanitized = {
      name: name.trim().replace(/[<>&"']/g, ''),
      email: email.toLowerCase().trim(),
      message: message.trim().substring(0, 2000), // Limit length
    };

    console.log('Contact form submission:', sanitized);

    return NextResponse.json({
      message: 'تم إرسال رسالتك بنجاح. سنتواصل معك في أقرب وقت.',
    });
  } catch (error: unknown) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إرسال الرسالة' },
      { status: 500 }
    );
  }
}
