import { NextRequest, NextResponse } from 'next/server';

// Rate limiting for contact form
const contactRateLimit = new Map<string, { count: number; windowStart: number }>();
const MAX_CONTACT_REQUESTS = 3;
const CONTACT_WINDOW_MS = 10 * 60 * 1000; // 3 per 10 minutes

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const now = Date.now();
    const entry = contactRateLimit.get(clientIp);
    if (!entry || now - entry.windowStart > CONTACT_WINDOW_MS) {
      contactRateLimit.set(clientIp, { count: 1, windowStart: now });
    } else if (entry.count >= MAX_CONTACT_REQUESTS) {
      return NextResponse.json({ error: 'طلبات كثيرة. يرجى المحاولة بعد 10 دقائق' }, { status: 429 });
    } else {
      entry.count += 1;
    }

    const body = await request.json();
    const { name, email, message } = body;

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      return NextResponse.json(
        { error: 'يجب أن يكون الاسم حرفين على الأقل' },
        { status: 400 }
      );
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email) || email.length > 254) {
      return NextResponse.json(
        { error: 'يرجى إدخال بريد إلكتروني صحيح' },
        { status: 400 }
      );
    }

    // Validate message
    if (!message || typeof message !== 'string' || message.trim().length < 10 || message.trim().length > 2000) {
      return NextResponse.json(
        { error: 'يجب أن تكون الرسالة 10 أحرف على الأقل' },
        { status: 400 }
      );
    }

    // In a real application, you would send an email or save to database
    // For now, just return success
    console.log('Contact form submission:', { name: name.trim(), email: email.toLowerCase().trim(), message: message.trim() });

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
