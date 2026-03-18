import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = body.message || body.text || '';

    if (!message || message.trim() === '') {
      return NextResponse.json({ 
        reply: 'يرجى كتابة رسالة.'
      });
    }

    // إنشاء SDK
    const zai = await ZAI.create();

    // إرسال الطلب
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `أنت مساعد ذكي لموقع "منطقتي" للعقارات في مصر.
          تساعد المستخدمين في البحث عن شقق وعقارات.
          أجب بالعربية فقط وبإجابات مختصرة ومفيدة.
          يمكنك المساعدة في:
          - البحث عن شقق للإيجار أو البيع
          - تصفية النتائج حسب السعر والمنطقة وعدد الغرف
          - تقديم نصائح للبحث عن العقارات المناسبة
          - الرد على استفسارات العملاء بشكل ودود`
        },
        {
          role: 'user',
          content: message
        }
      ],
      thinking: { type: 'disabled' }
    });

    const reply = completion.choices[0]?.message?.content || 'عذراً، لم أفهم سؤالك.';

    return NextResponse.json({ reply });

  } catch (error) {
    console.error('AI Chat error:', error);
    return NextResponse.json({ 
      reply: 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.'
    });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    message: 'AI Chat API يعمل بشكل صحيح'
  });
}