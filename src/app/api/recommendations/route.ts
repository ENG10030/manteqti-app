import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

export async function POST(request: NextRequest) {
  try {
    const { preferences, budget, bedrooms, type, area } = await request.json();

    // Get all available apartments
    const apartments = await db.apartment.findMany({
      where: { status: 'available' },
      orderBy: { createdAt: 'desc' }
    });

    if (apartments.length === 0) {
      return NextResponse.json({ 
        success: true, 
        recommendations: [],
        analysis: 'لا توجد شقق متاحة حالياً'
      });
    }

    // Filter based on basic criteria
    let filtered = apartments;
    
    if (type) {
      filtered = filtered.filter(apt => apt.type === type);
    }
    if (bedrooms) {
      filtered = filtered.filter(apt => apt.bedrooms >= bedrooms);
    }
    if (budget) {
      filtered = filtered.filter(apt => apt.price <= budget);
    }
    if (area) {
      filtered = filtered.filter(apt => apt.area.includes(area));
    }

    // Use AI to analyze and rank apartments based on preferences
    const zai = await getZAI();

    const apartmentsData = filtered.slice(0, 10).map(apt => ({
      id: apt.id,
      title: apt.title,
      price: apt.price,
      area: apt.area,
      bedrooms: apt.bedrooms,
      bathrooms: apt.bathrooms,
      description: apt.description,
      type: apt.type,
      amenities: apt.amenities ? JSON.parse(apt.amenities) : []
    }));

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `أنت خبير عقارات متخصص في تحليل ومطابقة الشقق مع احتياجات العملاء.
قم بتحليل الشقق المتاحة وتقديم توصيات مخصصة.
أجب باللغة العربية دائماً.
قدم تحليلاً موجزاً يوضح سبب التوصية بكل شقة.`
        },
        {
          role: 'user',
          content: `تفضيلات العميل: ${preferences || 'لم يحدد تفضيلات محددة'}
الميزانية: ${budget ? budget.toLocaleString() + ' ج.م' : 'لم يحدد'}
عدد الغرف المطلوب: ${bedrooms || 'لم يحدد'}
نوع العقار: ${type === 'rent' ? 'إيجار' : type === 'sale' ? 'بيع' : 'لم يحدد'}
المنطقة: ${area || 'لم يحدد'}

الشقق المتاحة:
${JSON.stringify(apartmentsData, null, 2)}

قدم قائمة بالشقق الأنسب مرتبة حسب ملاءمتها لاحتياجات العميل، مع شرح موجز لكل توصية.`
        }
      ],
      thinking: { type: 'disabled' }
    });

    const analysis = completion.choices[0]?.message?.content || 'لم نتمكن من تحليل الشقق';

    return NextResponse.json({
      success: true,
      recommendations: filtered.slice(0, 5),
      analysis,
      totalFound: filtered.length
    });
  } catch (error) {
    console.error('Recommendation error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get recommendations'
    }, { status: 500 });
  }
}
