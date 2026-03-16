import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { type, area, bedrooms, bathrooms, features, price } = await request.json();

    const zai = await ZAI.create();

    const prompt = `اكتب وصفاً جذاباً ومهنياً لشقة بالعربية تتضمن:

نوع العقار: ${type === 'rent' ? 'للإيجار' : 'للبيع'}
المنطقة: ${area}
غرف النوم: ${bedrooms}
الحمامات: ${bathrooms}
السعر: ${price?.toLocaleString() || 'غير محدد'} ج.م
المميزات: ${features?.join('، ') || 'غير محددة'}

الوصف يجب أن يكون:
- جذاباً للمشترين أو المستأجرين
- مهنياً وواضحاً
- يتضمن مميزات الموقع والخدمات القريبة
- لا يتجاوز 150 كلمة

اكتب الوصف فقط بدون مقدمات:`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: 'أنت خبير تسويق عقاري تكتب أوصافاً جذابة ومهنية للعقارات.' },
        { role: 'user', content: prompt }
      ],
      thinking: { type: 'disabled' }
    });

    const description = completion.choices[0]?.message?.content;

    return NextResponse.json({
      success: true,
      description
    });
  } catch (error) {
    console.error('Description generation error:', error);
    return NextResponse.json({ error: 'Failed to generate description' }, { status: 500 });
  }
}
