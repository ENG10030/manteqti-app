import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, message } = body;

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'يجب أن يكون الاسم حرفين على الأقل' },
        { status: 400 }
      );
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'يرجى إدخال بريد إلكتروني صحيح' },
        { status: 400 }
      );
    }

    // Validate message
    if (!message || typeof message !== 'string' || message.trim().length < 10) {
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
