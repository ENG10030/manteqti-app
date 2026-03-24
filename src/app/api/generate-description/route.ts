import { NextRequest, NextResponse } from 'next/server';

// Check if we're in development environment with SDK available
let ZAI_AVAILABLE = false;

async function getZAI() {
  try {
    // Dynamic import to avoid build errors when SDK is not available
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    ZAI_AVAILABLE = true;
    return await ZAI.create();
  } catch (e) {
    console.log('ZAI SDK not available, using fallback descriptions');
    ZAI_AVAILABLE = false;
    return null;
  }
}

// Fallback description generator
function generateFallbackDescription(data: {
  type: string;
  area: string;
  bedrooms: number;
  bathrooms: number;
  price?: number;
  features?: string[];
}): string {
  const { type, area, bedrooms, bathrooms, price, features } = data;
  const typeText = type === 'rent' ? 'للإيجار' : 'للبيع';
  
  let description = `🏠 ${typeText === 'للإيجار' ? 'شقة فاخرة للإيجار' : 'شقة فاخرة للبيع'} في ${area}

✨ المواصفات:
• ${bedrooms} غرف نوم
• ${bathrooms} حمام
• تصميم عصري وفاخر

📍 الموقع:
${area} - موقع متميز قريب من جميع الخدمات والمرافق

💰 السعر: ${price ? price.toLocaleString() + ' ج.م' : 'للتفاوض'}`;

  if (features && features.length > 0) {
    description += `\n\n🎯 المميزات:\n${features.map(f => `• ${f}`).join('\n')}`;
  }

  description += `\n\n📞 للاستفسار والمعاينة، تواصل معنا الآن!`;

  return description;
}

export async function POST(request: NextRequest) {
  try {
    const { type, area, bedrooms, bathrooms, features, price } = await request.json();

    // Try to use AI SDK
    try {
      const zai = await getZAI();

      if (!zai || !ZAI_AVAILABLE) {
        // Use fallback when SDK is not available
        const description = generateFallbackDescription({ type, area, bedrooms, bathrooms, price, features });
        return NextResponse.json({
          success: true,
          description,
          fallback: true
        });
      }

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
    } catch (aiError) {
      console.error('AI error, using fallback:', aiError);
      const description = generateFallbackDescription({ type, area, bedrooms, bathrooms, price, features });
      return NextResponse.json({
        success: true,
        description,
        fallback: true
      });
    }
  } catch (error) {
    console.error('Description generation error:', error);
    return NextResponse.json({ error: 'Failed to generate description' }, { status: 500 });
  }
}
