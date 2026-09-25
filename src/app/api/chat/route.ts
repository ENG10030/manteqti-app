import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAiClient } from '@/lib/ai';

// ============================================================
// المساعد الذكي الحقيقي — بيبحث فعلياً في العقارات الموجودة
// 1) يقرأ العقارات المتاحة من قاعدة البيانات
// 2) يفهم نية المستخدم (المنطقة / نوع العرض / عدد الغرف / الميزانية)
// 3) يفلتر النتائج الحقيقية ويرجعها + رد مبني عليها
// 4) لو موديل الذكاء الاصطناعي متاح (بيئة التطوير) بيستخدمه
//    مع تمرير العقارات الحقيقية له حتى لا يخترع بيانات
// ============================================================

// Rate limiting for chat (prevent abuse)
const chatRateLimit = new Map<string, { count: number; windowStart: number }>();
const MAX_CHAT_REQUESTS = 30;
const CHAT_WINDOW_MS = 60 * 1000; // 30 per minute

type ChatListing = {
  id: string;
  title: string;
  area: string;
  price: number;
  type: string;
  bedrooms: number;
  bathrooms: number;
  apartmentSize: number | null;
  imageUrl: string | null;
};

// ===== أدوات فهم العربية (مصرية) =====

// تحويل الأرقام العربية الهندية ٠-٩ إلى 0-9
function normalizeDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

// تطبيع النص العربي للمقارنة (همزات/تاء مربوطة/ال التعريف)
function normalizeArabic(s: string): string {
  return normalizeDigits(s.toLowerCase())
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْ]/g, '')
    .replace(/ال(?=[\u0621-\u064A]{2,})/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// كلمات المناطق الشائعة في مصر (للتفريق بين "منطقة" وأرقام عادية)
const COMMON_AREA_HINTS = ['المعادي', 'مدينة نصر', 'التجمع', 'مصر الجديدة', 'وسط البلد', 'المهندسين', 'الدقي', 'المقطم', 'الشيخ زايد', '6 اكتوبر', 'الهرم', 'فيصل', 'حلوان', 'المرج', 'عين شمس', 'شبرا', 'الزاويه الحمراء', 'الرحاب', 'مدنتي', 'العبور', 'القاهرة الجديدة', 'المعادي الجديدة', 'الدوري', 'الكوربة', 'مسطرد', 'حدائق القبة', 'المنيل', 'الدرب الأحمر'];

function detectType(msg: string): 'rent' | 'sale' | null {
  if (/ايجار|استئجار|استاجار|كراء|rent/i.test(msg)) return 'rent';
  if (/بيع|شراء|تمليك|sale|buy/i.test(msg)) return 'sale';
  return null;
}

function detectBedrooms(msg: string): number | null {
  const m = normalizeDigits(msg);
  // أرقام صريحة: "3 غرف" / "٣ غرف"
  const digitMatch = m.match(/(\d+)\s*(غرف|غرفة|غرфе|اوض|أوض|room)/);
  if (digitMatch) {
    const n = parseInt(digitMatch[1], 10);
    if (n >= 1 && n <= 20) return n;
  }
  // كلمات: غرفتين، ثلاث غرف...
  const wordMap: [RegExp, number][] = [
    [/غرفتين|اتنين\s*غرف|غرفتين|two\s*room/i, 2],
    [/ثلاث|تلاتة|تلات|three\s*room/i, 3],
    [/اربع|أربع|اربعه|four\s*room/i, 4],
    [/خمس|five\s*room/i, 5],
    [/غرفتين|واحدة|واحد\s*غرف|غرف؟?\s*واحد/i, 1],
  ];
  for (const [re, n] of wordMap) if (re.test(m)) return n;
  return null;
}

function detectMaxPrice(msg: string): { amount: number; isMillion: boolean } | null {
  const m = normalizeDigits(msg);
  // أمثلة: "بـ 5000" / "ميزانيتي 8000" / "في حدود 2 مليون" / "5000 جنيه"
  const patterns = [
    /(?:ميزانيه|ميزانية|بميزانية|في حدود|بحدود|حوالي|من\s*\d+\s*الي|اقل من|أقل من|ب\s*)\s*([\d,\.]+)\s*(مليون|الف|ألف)?/,
    /([\d,\.]+)\s*(مليون|جنيه|ج\.م|الف|ألف)/,
  ];
  for (const re of patterns) {
    const match = m.match(re);
    if (match) {
      const raw = parseFloat(match[1].replace(/[,\s]/g, ''));
      if (isNaN(raw) || raw <= 0) continue;
      const unit = match[2] || '';
      if (unit.includes('مليون') || /مليون/.test(m.slice(m.indexOf(match[1]), m.indexOf(match[1]) + 20))) {
        return { amount: Math.round(raw * 1_000_000), isMillion: true };
      }
      if (unit.includes('الف') || unit.includes('ألف')) return { amount: Math.round(raw * 1000), isMillion: false };
      // أرقام كبيرة بدون وحدة: لو > 100000 اعتبرها سعر كامل، لو < 100000 في سياق بيع اعتبرها بالألف؟ لا — خذها كما هي
      return { amount: Math.round(raw), isMillion: false };
    }
  }
  return null;
}

function detectArea(msg: string, listings: ChatListing[]): string | null {
  const normMsg = ' ' + normalizeArabic(msg) + ' ';
  // أولاً: كلمات مناطق معروفة
  for (const hint of COMMON_AREA_HINTS) {
    if (normMsg.includes(' ' + normalizeArabic(hint))) return hint;
  }
  // ثانياً: أي كلمة/عبارة في الرسالة تطابق منطقة موجودة فعلاً في العقارات
  for (const l of listings) {
    const normArea = normalizeArabic(l.area);
    if (normArea.length >= 3 && normMsg.includes(' ' + normArea + ' ')) return l.area;
  }
  // ثالثاً: "في X" — منطقة المستخدم غير موجودة عندنا، نرجعها زي ما هي
  // عشان نرد عليه بصدق: "مفيش عقارات في X حالياً"
  const inMatches = [...normMsg.matchAll(/(?:^|\s)في\s+([\u0621-\u064A][\u0621-\u064A\s]{1,30}?)(?=\s|$)/g)];
  for (const m of inMatches) {
    // نشيل كلمات "للإيجار/للبيع/بـ..." وقصّر على أول كلمتين مفيدتين
    const words = m[1].split(/\s+/).filter((w) => w.length >= 2 && !w.startsWith('لل') && !['ايجار', 'بيع', 'شراء', 'شقه', 'شقة'].includes(w));
    if (words.length === 0) continue;
    const candidate = words.slice(0, 2).join(' ');
    const matchesAny = listings.some((l) => {
      const na = normalizeArabic(l.area);
      return na.includes(candidate) || candidate.includes(na);
    });
    if (!matchesAny) return candidate;
  }
  return null;
}

function formatListingLine(l: ChatListing, currency: string): string {
  const typeLabel = l.type === 'rent' ? 'للإيجار' : 'للبيع';
  const sizePart = l.apartmentSize ? ` | 📐 ${l.apartmentSize} م²` : '';
  const priceLabel = l.price === 0 ? 'مجاني ✨' : `${l.price.toLocaleString('en-US')} ${currency}${l.type === 'rent' ? '/شهر' : ''}`;
  return `🏠 ${l.title}\n📍 ${l.area} | 🛏️ ${l.bedrooms} غرف | 🚿 ${l.bathrooms} حمام${sizePart}\n💰 ${priceLabel} (${typeLabel})`;
}

export async function POST(request: NextRequest) {
  let body: any = null;

  try {
    body = await request.json();
    const { sessionId, message } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({
        success: true,
        response: '🏠 أهلاً بك في منطقتي!\n\nاسألني عن أي عقار: "عايز شقة 3 غرف في المعادي للإيجار" أو "شقق للبيع في التجمع بميزانية 2 مليون"',
        results: [],
      });
    }

    // ===== 1) قراءة العقارات المتاحة فعلياً من قاعدة البيانات =====
    let available: ChatListing[] = [];
    let currency = 'ج.م';
    try {
      const [apts, settings] = await Promise.all([
        db.apartment.findMany({
          where: { status: 'available', archivedAt: null },
          orderBy: [{ isVip: 'desc' }, { isFeatured: 'desc' }, { createdAt: 'desc' }],
          take: 80,
          select: {
            id: true, title: true, area: true, price: true, type: true,
            bedrooms: true, bathrooms: true, apartmentSize: true,
            imageUrl: true, images: true,
          },
        }),
        db.settings.findFirst({ select: { currency: true } }).catch(() => null),
      ]);
      currency = settings?.currency || 'ج.م';
      available = apts.map((a: any) => ({
        id: a.id,
        title: a.title,
        area: a.area,
        price: a.price,
        type: a.type,
        bedrooms: a.bedrooms,
        bathrooms: a.bathrooms,
        apartmentSize: a.apartmentSize,
        imageUrl: a.imageUrl || (a.images ? safeFirstImage(a.images) : null),
      }));
    } catch (dbErr) {
      console.error('[chat] DB read failed:', dbErr);
    }

    // ===== 2) فهم نية المستخدم =====
    const wantedType = detectType(message);
    const wantedBedrooms = detectBedrooms(message);
    const priceInfo = detectMaxPrice(message);
    const wantedArea = detectArea(message, available);
    const maxPrice = priceInfo?.amount ?? null;

    // ===== 3) الفلترة على الداتا الحقيقية =====
    let results: ChatListing[] = [];
    let relaxedNote = '';
    if (available.length > 0) {
      let filtered = available;
      if (wantedType) filtered = filtered.filter((l) => l.type === wantedType);
      if (wantedArea) filtered = filtered.filter((l) => normalizeArabic(l.area).includes(normalizeArabic(wantedArea)) || normalizeArabic(wantedArea).includes(normalizeArabic(l.area)));
      if (wantedBedrooms) filtered = filtered.filter((l) => l.bedrooms >= wantedBedrooms).sort((a, b) => a.bedrooms - b.bedrooms);
      if (maxPrice) filtered = filtered.filter((l) => l.price <= maxPrice * 1.1);

      // لو الفلترة الصارمة طلعت فاضية: خفف شرط السعر ثم الغرف
      if (filtered.length === 0 && (maxPrice || wantedBedrooms)) {
        let relaxed = available;
        if (wantedType) relaxed = relaxed.filter((l) => l.type === wantedType);
        if (wantedArea) relaxed = relaxed.filter((l) => normalizeArabic(l.area).includes(normalizeArabic(wantedArea)));
        if (relaxed.length === 0 && wantedArea) relaxed = available.filter((l) => l.type === (wantedType || l.type));
        filtered = relaxed.sort((a, b) => Math.abs(a.price - (maxPrice || a.price)) - Math.abs(b.price - (maxPrice || b.price)));
        relaxedNote = '\n\n💡 ملحوظة: مفيش عقار مطابق 100% لكل شروطك، فدي أقرب الخيارات المتاحة.';
      }

      results = filtered.slice(0, 8);
    }

    const intentParts: string[] = [];
    if (wantedArea) intentParts.push(`المنطقة: ${wantedArea}`);
    if (wantedType) intentParts.push(wantedType === 'rent' ? 'للإيجار' : 'للبيع');
    if (wantedBedrooms) intentParts.push(`${wantedBedrooms} غرف فأكثر`);
    if (maxPrice) intentParts.push(`حتى ${maxPrice.toLocaleString('en-US')} ${currency}`);
    const intentText = intentParts.length ? ` (${intentParts.join(' • ')})` : '';

    // ===== 4) محاولة الموديل الذكي (متاح في بيئة التطوير) مع العقارات الحقيقية =====
    try {
      const zai = await getAiClient();
      if (zai) {
        const listingsContext = (results.length > 0 ? results : available.slice(0, 12))
          .map((l, i) => `${i + 1}) id:${l.id} | "${l.title}" | ${l.area} | ${l.bedrooms} غرف | ${l.bathrooms} حمام | ${l.apartmentSize || '?'} م² | ${l.price} ${currency} | ${l.type === 'rent' ? 'إيجار' : 'بيع'}`)
          .join('\n');

        const systemPrompt = `أنت مساعد ذكي متخصص في العقارات على منصة "منطقتي" في مصر.
مهمتك: البحث عن العقارات المناسبة للمستخدم من القائمة الحقيقية أدناه فقط، والإجابة عن أسئلته عن الأسعار والمناطق.

قواعد صارمة:
1. استخدم فقط العقارات الموجودة في القائمة — ممنوع اختراع عقارات أو أسعار أو مناطق غير موجودة فيها.
2. لو المستخدم طلب شروطاً غير متوفرة، قل ذلك بصراحة واقترح أقرب الخيارات من القائمة.
3. اذكر العنوان والمنطقة وعدد الغرف والسعر بالجنيه المصري كما في القائمة بالضبط.
4. أجب بالعربية المصرية البسيطة، بوضوع واختصار، واستخدم إيموجي مناسبة.
5. لو الرسالة ترحيب أو سؤال عام، رحب واقترح ما يمكن البحث عنه (مثال: "عايز شقة 3 غرف في المعادي").

إحصائيات المنصة: ${available.length} عقار متاح الآن.
طلب المستخدم المفهوم${intentText}:
"${message}"

العقارات المتاحة حالياً:
${listingsContext || '(لا توجد عقارات متاحة حالياً)'}`;

        const completionPromise = zai.chat.completions.create({
          messages: [
            { role: 'system' as const, content: systemPrompt },
            { role: 'user' as const, content: message },
          ],
          thinking: { type: 'disabled' },
        });

        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error('AI timeout')), 20000);
        });

        const completion = await Promise.race([completionPromise, timeoutPromise]);

        if (completion && completion.choices?.[0]?.message?.content) {
          return NextResponse.json({
            success: true,
            response: completion.choices[0].message.content,
            results,
            ai: true,
          });
        }
      }
    } catch {
      // الموديل غير متاح — نستخدم الرد المبني على الداتا الحقيقية
    }

    // ===== 5) الرد الاحتياطي المبني على نتائج حقيقية (بيئة الإنتاج) =====
    let reply: string;

    if (available.length === 0) {
      reply = `🏠 حالياً لا توجد عقارات متاحة للعرض.\n\nتقدر تضيف عقارك من زر "أضف عقارك" أو ترجع تسألني لاحقاً! 😊`;
    } else if (results.length > 0) {
      const shown = results.slice(0, 6).map((l) => formatListingLine(l, currency)).join('\n\n———\n\n');
      reply = `🔍 لقيت لك ${results.length} عقار${results.length > 2 ? 'ات' : ''} مناسب${results.length > 2 ? 'ة' : ''}${intentText}:\n\n${shown}${relaxedNote}\n\n👆 اضغط على أي نتيجة بالأسفل لعرض تفاصيلها وصورها.`;
    } else if (wantedArea) {
      const others = available.slice(0, 4).map((l) => formatListingLine(l, currency)).join('\n\n———\n\n');
      reply = `📍 للأسف مفيش عقارات متاحة حالياً في "${wantedArea}".\n\nبس دي أحدث العقارات المتاحة في مناطق تانية:\n\n${others}\n\nجرب منطقة تانية أو زود ميزانيتك شوية 🙌`;
    } else {
      const shown = available.slice(0, 5).map((l) => formatListingLine(l, currency)).join('\n\n———\n\n');
      reply = `🏠 أهلاً! دي أحدث العقارات المتاحة حالياً (${available.length} عقار):\n\n${shown}\n\n🔍 لتصفية أدخل: المنطقة، عدد الغرف، للإيجار أو للبيع، وميزانيتك — مثال: "شقة 3 غرف في مدينة نصر للإيجار بـ 8000".`;
    }

    return NextResponse.json({
      success: true,
      response: reply,
      results,
      fallback: true,
    });

  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({
      success: true,
      response: 'عذراً، حصلت مشكلة مؤقتة في البحث. جرّب تاني بعد لحظات 🙏',
      results: [],
      fallback: true,
    });
  }
}

function safeFirstImage(imagesJson: string): string | null {
  try {
    const arr = JSON.parse(imagesJson);
    return Array.isArray(arr) && arr.length > 0 ? String(arr[0]) : null;
  } catch {
    return null;
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
