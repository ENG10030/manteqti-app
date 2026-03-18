import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'الرسالة مطلوبة' }, { status: 400 });
    }

    const zai = await ZAI.create();

    const response = await zai.chat.completions.create({
      model: 'glm-4',
      messages: [
        {
          role: 'system',
          content: `أنت مساعد ذكي لموقع "منطقتي" للعقارات في مصر.
          تساعد المستخدمين في البحث عن شقق وعقارات.
          أجب بالعربية فقط وبإجابات مختصرة ومفيدة.
          يمكنك المساعدة في:
          - البحث عن شقق للإيجار أو البيع
          - تصفية النتائج حسب السعر والمنطقة وعدد الغرف
          - تقديم نصائح للبحث عن العقارات المناسبة`
        },
        {
          role: 'user',
          content: message
        }
      ],
    });

    const reply = response.choices[0]?.message?.content || 'عذراً، لم أفهم سؤالك.';

    return NextResponse.json({ reply });

  } catch (error) {
    console.error('AI Chat error:', error);
    return NextResponse.json({ 
      error: 'حدث خطأ في الاتصال بالمساعد الذكي',
      reply: 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.'
    }, { status: 500 });
  }
}