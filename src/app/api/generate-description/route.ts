import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';

export const dynamic = "force-dynamic";

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
  
  let description = `🏠 شقة فاخرة ${typeText} في ${area}

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
  const auth = authenticateRequest(request);
  if (!auth) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  try {
    const { type, area, bedrooms, bathrooms, features, price } = await request.json();

    // Try to use AI SDK for generating description
    try {
      const mod: any = await import('z-ai-web-dev-sdk').catch(() => null);
      
      if (mod?.default && typeof mod.default.create === 'function') {
        const zai = await mod.default.create();

        const prompt = `اكتب وصف عقاري جذاب ومقنع باللغة العربية لهذه الشقة:
- النوع: ${type === 'rent' ? 'إيجار' : 'بيع'}
- المنطقة: ${area}
- عدد الغرف: ${bedrooms}
- عدد الحمامات: ${bathrooms}
- السعر: ${price ? price.toLocaleString() + ' ج.م' : 'للتفاوض'}
${features && features.length > 0 ? `- المميزات: ${features.join('، ')}` : ''}

اكتب وصف احترافي يجذب المشترين/المستأجرين. استخدم الرموز التعبيرية. لا تتجاوز 150 كلمة.`;

        const completionPromise = zai.chat.completions.create({
          messages: [
            { role: 'system', content: 'أنت كاتب وصف عقاري محترف. اكتب أوصاف جذابة ومقنعة باللغة العربية.' },
            { role: 'user', content: prompt }
          ],
          thinking: { type: 'disabled' }
        });

        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error('AI timeout')), 15000);
        });

        const completion = await Promise.race([completionPromise, timeoutPromise]);

        if (completion?.choices?.[0]?.message?.content) {
          return NextResponse.json({
            success: true,
            description: completion.choices[0].message.content,
            ai: true
          });
        }
      }
    } catch {
      // AI not available, use fallback
    }

    // Fallback description
    const description = generateFallbackDescription({ type, area, bedrooms, bathrooms, price, features });
    
    return NextResponse.json({
      success: true,
      description
    });
  } catch {
    return NextResponse.json({ error: 'Failed to generate description' }, { status: 500 });
  }
}
