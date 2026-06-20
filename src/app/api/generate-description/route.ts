import { NextRequest, NextResponse } from 'next/server';
import { getAiClient } from '@/lib/ai';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '@/lib/auth';

// Rate limiting for AI description generation (prevent API cost abuse)
const descRateLimit = new Map<string, { count: number; windowStart: number }>();
const MAX_DESC_REQUESTS = 10;
const DESC_WINDOW_MS = 60 * 60 * 1000; // 10 per hour

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
  try {
    // ⛔ SECURITY: Require authentication to prevent API cost abuse
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 });
    }
    try {
      verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'جلسة غير صالحة' }, { status: 401 });
    }

    // Rate limiting by IP
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const now = Date.now();
    const entry = descRateLimit.get(clientIp);
    if (!entry || now - entry.windowStart > DESC_WINDOW_MS) {
      descRateLimit.set(clientIp, { count: 1, windowStart: now });
    } else if (entry.count >= MAX_DESC_REQUESTS) {
      return NextResponse.json({ error: 'طلبات كثيرة. يرجى المحاولة بعد ساعة' }, { status: 429 });
    } else {
      entry.count += 1;
    }

    const { type, area, bedrooms, bathrooms, features, price } = await request.json();

    // Try to use AI SDK for generating description
    try {
      const zai = await getAiClient();

      if (zai) {

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
