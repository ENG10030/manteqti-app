import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function generateFallbackAnalysis(
  apartments: any[],
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
    const { budget, bedrooms, type, area } = await request.json();

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

    const analysis = generateFallbackAnalysis(filtered, budget, bedrooms, type, area);
    
    return NextResponse.json({
      success: true,
      recommendations: filtered.slice(0, 5),
      analysis,
      totalFound: filtered.length
    });
  } catch {
    return NextResponse.json({
      success: false,
      error: 'Failed to get recommendations'
    }, { status: 500 });
  }
}