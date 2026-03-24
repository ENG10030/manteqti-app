import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Check if we're in development environment with SDK available
let ZAI_AVAILABLE = false;

async function getZAI() {
  try {
    // Dynamic import to avoid build errors when SDK is not available
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    ZAI_AVAILABLE = true;
    return await ZAI.create();
  } catch (e) {
    console.log('ZAI SDK not available for recommendations');
    ZAI_AVAILABLE = false;
    return null;
  }
}

// Generate fallback analysis based on filtered apartments
function generateFallbackAnalysis(
  apartments: any[],
  preferences: string | null,
  budget: number | null,
  bedrooms: number | null,
  type: string | null,
  area: string | null
): string {
  if (apartments.length === 0) {
    return '⚠️ لم يتم العثور على شقق مطابقة لمعايير البحث.\n\nجرب تعديل المعايير أو إزالة بعض الفلاتر للحصول على نتائج أكثر.';
  }

  let analysis = `🔍 تم العثور على ${apartments.length} شقة مطابقة لبحثك!\n\n`;
  
  const typeText = type === 'rent' ? 'للإيجار' : type === 'sale' ? 'للبيع' : 'جميع العقارات';
  analysis += `📋 نوع البحث: ${typeText}\n`;
  
  if (budget) {
    analysis += `💰 الميزانية: حتى ${budget.toLocaleString()} ج.م\n`;
  }
  
  if (bedrooms) {
    analysis += `🛏️ عدد الغرف: ${bedrooms}+ غرفة\n`;
  }
  
  if (area) {
    analysis += `📍 المنطقة: ${area}\n`;
  }
  
  analysis += '\n🏆 أفضل الخيارات:\n\n';
  
  // Show top 3 apartments
  apartments.slice(0, 3).forEach((apt, index) => {
    analysis += `${index + 1}. ${apt.title}\n`;
    analysis += `   💵 ${apt.price.toLocaleString()} ج.م\n`;
    analysis += `   📍 ${apt.area}\n`;
    analysis += `   🛏️ ${apt.bedrooms} غرف | 🚿 ${apt.bathrooms} حمام\n\n`;
  });
  
  if (apartments.length > 3) {
    analysis += `📄 وهناك ${apartments.length - 3} عقارات أخرى متاحة...\n`;
  }
  
  analysis += '\n📞 للتواصل والمعاينة، تواصل معنا!';
  
  return analysis;
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

    // Try to use AI for analysis
    try {
      const zai = await getZAI();

      if (!zai || !ZAI_AVAILABLE) {
        // Use fallback analysis when SDK is not available
        const analysis = generateFallbackAnalysis(filtered, preferences, budget, bedrooms, type, area);
        return NextResponse.json({
          success: true,
          recommendations: filtered.slice(0, 5),
          analysis,
          totalFound: filtered.length,
          fallback: true
        });
      }

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
    } catch (aiError) {
      console.error('AI recommendation error, using fallback:', aiError);
      const analysis = generateFallbackAnalysis(filtered, preferences, budget, bedrooms, type, area);
      return NextResponse.json({
        success: true,
        recommendations: filtered.slice(0, 5),
        analysis,
        totalFound: filtered.length,
        fallback: true
      });
    }
  } catch (error) {
    console.error('Recommendation error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get recommendations'
    }, { status: 500 });
  }
}
