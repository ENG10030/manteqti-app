import { NextRequest, NextResponse } from "next/server";
import { getAiClient } from "@/lib/ai";
import { getAuthContext } from '@/lib/auth-middleware';

// Rate limiting for AI comparison
const compareRateLimit = new Map<string, { count: number; windowStart: number }>();
const MAX_COMPARE_REQUESTS = 5;
const COMPARE_WINDOW_MS = 60 * 60 * 1000; // 5 per hour

interface ApartmentData {
  id: string;
  title: string;
  type: string;
  price: number;
  area: number;
  bedrooms: number;
  bathrooms: number;
  floor: number;
  location: string;
  city: string;
  furnishing: string;
  rating: number;
  amenities: { label: string }[];
  description: string;
}

function generateMockAnalysis(apartments: ApartmentData[]) {
  // Sort by value score: area/price ratio for rent, or area/price for sale
  const ranked = [...apartments].sort((a, b) => {
    const scoreA = a.area / a.price;
    const scoreB = b.area / b.price;
    return scoreB - scoreA;
  });

  const best = ranked[0];

  const pros = apartments.map((apt) => ({
    apartmentId: apt.id,
    title: apt.title,
    points: [
      apt.area >= 150 ? `مساحة واسعة تبلغ ${apt.area} م² مناسبة للعائلات` : `مساحة مناسبة ${apt.area} م² اقتصادية`,
      apt.rating >= 4.5 ? `تقييم ممتاز ${apt.rating}/5 يدل على رضا السكان` : `تقييم جيد ${apt.rating}/5`,
      apt.amenities.length >= 5
        ? `${apt.amenities.length} مميزات متاحة تشمل ${apt.amenities.slice(0, 3).map((a) => a.label).join("، ")}`
        : `مميزات أساسية متوفرة (${apt.amenities.length} مميزات)`,
      apt.furnishing === "مفروشة"
        ? "شقة مفروشة بالكامل توفير وقت وجهد التجهيز"
        : apt.furnishing === "نصف مفروشة"
        ? "نصف مفروشة - توازن جيد بين السعر والتجهيز"
        : "غير مفروشة - حرية التصميم حسب الذوق",
    ],
  }));

  const cons = apartments.map((apt) => {
    const points: string[] = [];
    const priceRank = [...apartments].sort((a, b) => a.price - b.price);
    if (priceRank.indexOf(apt) === priceRank.length - 1) {
      points.push("السعر الأعلى مقارنة بالبدائل المتاحة");
    }
    if (apt.area < 100) {
      points.push("مساحة صغيرة قد لا تكفي لعائلة كبيرة");
    }
    if (apt.bathrooms < 2 && apt.bedrooms >= 3) {
      points.push("عدد الحمامات أقل من المناسب لعدد الغرف");
    }
    if (apt.amenities.length < 4) {
      points.push("مميزات محدودة مقارنة بالشقق الأخرى");
    }
    if (apt.floor >= 8) {
      points.push("دور مرتفع قد يكون مشكلة في حالة انقطاع الكهرباء");
    }
    if (apt.rating < 4.5) {
      points.push(`تقييم ${apt.rating} أقل من المتوسط المطلوب`);
    }
    if (points.length === 0) {
      points.push("لا توجد عيوب جوهرية واضحة");
    }
    return { apartmentId: apt.id, title: apt.title, points };
  });

  const pricePerMeter = apartments
    .map((a) => `${a.title}: ${(a.price / a.area).toFixed(0)} ج.م/م²`)
    .join(" | ");

  return {
    analysis: {
      recommendation: `بناءً على تحليل شامل لـ ${apartments.length} شقق، نوصي بشقة "${best.title}" في ${best.city} كخيار الأفضل. تتميز بأفضل قيمة مقابل السعر حيث تبلغ تكلفة المتر المربع ${(best.price / best.area).toFixed(0)} ج.م فقط، مع مساحة ${best.area} م² وتقييم ${best.rating}/5. الشقة توفر توازنًا ممتازًا بين المساحة والسعر والموقع والمميزات. ${best.furnishing === "مفروشة" ? "كما أنها مفروشة بالكامل مما يوفر تكاليف إضافية." : ""}`,
      pros,
      cons,
      verdict: `بعد مراجعة جميع الخيارات المتاحة، شقة "${best.title}" تقدم أفضل قيمة شاملة. مع (${best.bedrooms} غرف، ${best.bathrooms} حمام، ${best.area} م²) بسعر ${best.price.toLocaleString("ar-EG")} ج.م${best.type === "إيجار" ? "/شهر" : ""}، تقدم هذه الشقة مزيجًا لا يُضاهى من المساحة والسعر والمميزات. نصيحتنا: اعرض الشقة شخصيًا وتأكد من حالة الصيانة والحي قبل اتخاذ القرار النهائي. مقارنة الأسعار لكل متر مربع: ${pricePerMeter}.`,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    // ⛔ SECURITY: Require authentication to prevent AI cost abuse
    const { auth, errorResponse } = await getAuthContext(request);
    if (errorResponse || !auth) return errorResponse;

    // Rate limiting by IP
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const now = Date.now();
    const entry = compareRateLimit.get(clientIp);
    if (!entry || now - entry.windowStart > COMPARE_WINDOW_MS) {
      compareRateLimit.set(clientIp, { count: 1, windowStart: now });
    } else if (entry.count >= MAX_COMPARE_REQUESTS) {
      return NextResponse.json({ error: 'طلبات كثيرة. يرجى المحاولة بعد ساعة' }, { status: 429 });
    } else {
      entry.count += 1;
    }

    const body = await request.json();
    const { apartments } = body as { apartments: ApartmentData[] };

    if (!apartments || apartments.length < 2) {
      return NextResponse.json(
        { error: "يجب اختيار شقتين على الأقل للمقارنة" },
        { status: 400 }
      );
    }

    if (apartments.length > 4) {
      return NextResponse.json(
        { error: "الحد الأقصى للمقارنة هو 4 شقق" },
        { status: 400 }
      );
    }

    // Try AI-powered analysis first, fallback to mock
    try {
      const client = await getAiClient();

      if (!client) {
        throw new Error('SDK not available');
      }

      const apartmentsInfo = apartments
        .map(
          (a, i) => `
الشقة ${i + 1}: ${a.title}
- النوع: ${a.type === "بيع" ? "للبيع" : "للإيجار"}
- السعر: ${a.price.toLocaleString("ar-EG")} ج.م${a.type === "إيجار" ? "/شهر" : ""}
- المساحة: ${a.area} م²
- غرف النوم: ${a.bedrooms}
- الحمامات: ${a.bathrooms}
- الدور: ${a.floor}
- الموقع: ${a.location}، ${a.city}
- التشطيب: ${a.furnishing}
- التقييم: ${a.rating}/5
- المميزات: ${a.amenities.map((am) => am.label).join("، ")}
- الوصف: ${a.description}`
        )
        .join("\n");

      const prompt = `أنت خبير عقاري مصري متخصص في تحليل الشقق. قم بتحليل الشقق التالية ومقارنتها:

${apartmentsInfo}

أجب بالتالي بالعربية وبنظام JSON فقط (بدون أي نص إضافي أو markdown):
{
  "recommendation": "توصيتك الأفضل مع الأسباب (فقرتين)",
  "pros": [
    {
      "apartmentId": "id",
      "title": "اسم الشقة",
      "points": ["ميزة 1", "ميزة 2", "ميزة 3", "ميزة 4"]
    }
  ],
  "cons": [
    {
      "apartmentId": "id",
      "title": "اسم الشقة",
      "points": ["عيب 1", "عيب 2", "عيب 3"]
    }
  ],
  "verdict": "الحكم النهائي والتوصية النهائية (فقرتين) مع مقارنة أسعار المتر المربع"
}`;

      const completion = await client.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "أنت خبير عقاري مصري. أجب بتنسيق JSON صالح فقط بدون أي نص إضافي أو backticks أو markdown.",
          },
          { role: "user", content: prompt },
        ],
      });

      let aiContent = completion.choices[0].message.content.trim();
      // Clean up markdown code blocks if present
      aiContent = aiContent
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      const analysis = JSON.parse(aiContent);

      // Validate structure
      if (
        analysis.recommendation &&
        analysis.pros &&
        analysis.cons &&
        analysis.verdict
      ) {
        return NextResponse.json({ analysis });
      }
    } catch (aiError) {
      console.error("AI analysis failed, using mock:", aiError);
    }

    // Fallback to mock analysis
    const result = generateMockAnalysis(apartments);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Compare AI error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء التحليل" },
      { status: 500 }
    );
  }
}
