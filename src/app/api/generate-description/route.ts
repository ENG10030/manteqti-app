import { NextRequest, NextResponse } from 'next/server';

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

    const description = generateFallbackDescription({ type, area, bedrooms, bathrooms, price, features });
    
    return NextResponse.json({
      success: true,
      description
    });
  } catch {
    return NextResponse.json({ error: 'Failed to generate description' }, { status: 500 });
  }
}