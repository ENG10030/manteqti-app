import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Store conversations in memory
const conversations = new Map<string, Array<{ role: 'assistant' | 'user'; content: string }>>();

// AI SDK instance (lazy initialized)
let zaiInstance: any = null;

async function getZAI() {
  if (zaiInstance) return zaiInstance;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ZAI = require('z-ai-web-dev-sdk').default;
    zaiInstance = await ZAI.create();
    console.log('✅ z-ai-web-dev-sdk initialized successfully');
    return zaiInstance;
  } catch (error: any) {
    console.error('❌ Failed to initialize z-ai-web-dev-sdk:', error?.message || error);
    return null;
  }
}

// Build dynamic system prompt with real apartment data from database
async function buildSystemPrompt(): Promise<string> {
  try {
    const apartments = await db.apartment.findMany({
      where: { status: { in: ['available', 'reserved', 'sold', 'rented'] } },
      select: {
        title: true,
        price: true,
        area: true,
        bedrooms: true,
        bathrooms: true,
        apartmentSize: true,
        type: true,
        description: true,
        isFeatured: true,
        isVip: true,
      },
      take: 50,
    });

    const rentListings = apartments.filter(a => a.type === 'rent');
    const saleListings = apartments.filter(a => a.type === 'sale');
    const areas = [...new Set(apartments.map(a => a.area))];
    const priceRangeRent = rentListings.length > 0
      ? `${Math.min(...rentListings.map(a => a.price)).toLocaleString('ar-EG')} - ${Math.max(...rentListings.map(a => a.price)).toLocaleString('ar-EG')} ج.م/شهر`
      : 'لا توجد حالياً';
    const priceRangeSale = saleListings.length > 0
      ? `${Math.min(...saleListings.map(a => a.price)).toLocaleString('ar-EG')} - ${Math.max(...saleListings.map(a => a.price)).toLocaleString('ar-EG')} ج.م`
      : 'لا توجد حالياً';

    const listingsSummary = apartments.map(a => {
      const typeLabel = a.type === 'rent' ? 'للإيجار' : 'للبيع';
      const badge = a.isVip ? ' ⭐VIP' : a.isFeatured ? ' 🔥مميز' : '';
      return `- ${a.title}${badge}: ${a.price.toLocaleString('ar-EG')} ج.م ${typeLabel === 'للإيجار' ? '/شهر' : ''} | ${a.area} | ${a.bedrooms} غرف | ${a.bathrooms} حمام | ${a.apartmentSize || '?'} م² | ${a.description}`;
    }).join('\n');

    return `أنت "منطقتي" - مساعد ذكي متخصص في العقارات والشقق في مصر. تعمل على موقع "منطقتي | Manteqti" للإعلانات العقارية.

📌 بيانات العقارات الحالية على الموقع:
إجمالي العقارات: ${apartments.length} (${rentListings.length} للإيجار، ${saleListings.length} للبيع)
المناطق المتاحة: ${areas.join('، ')}
أسعار الإيجار: ${priceRangeRent}
أسعار البيع: ${priceRangeSale}

📋 التفاصيل:
${listingsSummary || 'لا توجد عقارات حالياً'}

🎯 مهمتك:
- مساعدة المستخدمين في العثور على العقار المناسب لاحتياجاتهم
- الإجابة على أسئلة حول الأسعار والمناطق بناءً على البيانات الفعلية
- اقتراح العقارات المناسبة حسب ميزانية المستخدم والمنطقة المفضلة
- تقديم نصائح عملية حول الإيجار والشراء في مصر
- مقارنة بين العقارات المتاحة لمساعدة المستخدم في اتخاذ القرار

📋 قواعد مهمة جداً:
1. أجب باللغة العربية دائماً
2. كن ودوداً ومحترفاً ومختصراً
3. استخدم البيانات الفعلية من الموقع - لا تختلق أسعار أو عقارات
4. إذا سأل المستخدم عن منطقة معينة، اذكر العقارات المتاحة فيها فقط
5. إذا لم تجد عقار يناسب المستخدم، اقترح عليه البحث في مناطق قريبة
6. إذا سُئلت عن شيء خارج نطاق العقارات، وجه المحادثة بلطف نحو مجال تخصصك
7. استخدم الرموز التعبيرية بشكل معتدل لجعل الردود أكثر تفاعلاً
8. إذا طلب المستخدم معاينة شقة، أخبره بالتواصل مع صاحب العقار مباشرة من خلال صفحة العقار`;
  } catch (error) {
    console.error('Error building system prompt:', error);
    return `أنت "منطقتي" - مساعد ذكي متخصص في العقارات في مصر. أجب باللغة العربية دائماً وكن ودوداً ومحترفاً.`;
  }
}

// Fallback responses for when AI is unavailable
const fallbackResponses: { keywords: string[]; reply: string }[] = [
  {
    keywords: ['مرحبا', 'اهلا', 'السلام', 'صباح', 'مساء', 'هاي', 'hello'],
    reply: 'أهلاً بك! 👋 أنا مساعدك الذكي في منطقتي. كيف يمكنني مساعدتك في البحث عن عقار مناسب؟'
  },
  {
    keywords: ['شقة', 'شقق', 'عقار', 'عقارات'],
    reply: '🏠 يمكنني مساعدتك في العثور على الشقة المناسبة!\n\nأخبرني بـ:\n• المنطقة المفضلة\n• الميزانية\n• عدد الغرف\n• هل للإيجار أم للبيع؟'
  },
  {
    keywords: ['إيجار', 'ايجار', 'للإيجار'],
    reply: '🏠 أخبرني عن:\n• المنطقة اللي عايزها\n• ميزانيتك الشهرية\n• عدد الغرف المطلوب\nوهلاقي لك أفضل الخيارات! 🔍'
  },
  {
    keywords: ['بيع', 'للبيع', 'شراء', 'أشتري'],
    reply: '💰 عايز تشتري عقار؟ ممتاز!\n\nأخبرني بـ:\n• ميزانيتك\n• المنطقة المفضلة\n• نوع العقار (شقة/فيلا/دوبلكس)\nوهلاقي لك أفضل العروض! 🔍'
  },
  {
    keywords: ['سعر', 'أسعار', 'كم', 'بكام', 'ميزانية'],
    reply: '💵 الأسعار تختلف حسب المنطقة والمساحة والتميز.\n\nاستخدم فلاتر البحث في الموقع لتصفية حسب ميزانيتك، أو أخبرني بميزانيتك وهلاقي لك الخيارات المناسبة! 💡'
  },
  {
    keywords: ['غرفة', 'غرف', 'سرير'],
    reply: '🛏️ أخبرني بعدد الغرف اللي محتاجها والميزانية، وهلاقي لك الشقة المناسبة!'
  },
  {
    keywords: ['شكرا', 'شكراً', 'مشكور', 'thanks'],
    reply: 'العفو! 😊 سعيد بمساعدتك. إذا احتجت أي شيء آخر، أنا هنا دائماً! 🏠'
  }
];

const defaultReply = `🏠 أهلاً بك في منطقتي!

يمكنني مساعدتك في:
• 🔍 البحث عن شقق للإيجار أو البيع
• 💰 معرفة الأسعار المتاحة
• 📍 العقارات حسب المنطقة
• 🛏️ تحديد عدد الغرف المناسب

💡 جرب تسألني:
• "عايز شقة للإيجار في المعادي"
• "أفضل شقة بـ 3 غرف للشراء"
• "إيه أرخص شقة متاحة؟"

كيف يمكنني مساعدتك؟`;

function getFallbackReply(message: string): string {
  const lowerMessage = message.toLowerCase().trim();

  for (const item of fallbackResponses) {
    if (item.keywords.some(keyword => lowerMessage.includes(keyword))) {
      return item.reply;
    }
  }

  return defaultReply;
}

export async function POST(request: NextRequest) {
  let body: any = null;

  try {
    body = await request.json();
    const { sessionId, message } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({
        success: true,
        response: defaultReply
      });
    }

    // Try to use AI SDK
    try {
      const zai = await getZAI();

      if (!zai) {
        console.log('⚠️ AI SDK not available, using fallback responses');
        const fallbackReply = getFallbackReply(message);
        return NextResponse.json({
          success: true,
          response: fallbackReply,
          fallback: true
        });
      }

      // Build system prompt with real data from database
      const systemPrompt = await buildSystemPrompt();

      // Get or create conversation history
      let history = conversations.get(sessionId) || [];

      // If new conversation, add system prompt
      if (history.length === 0) {
        history.push({
          role: 'assistant' as const,
          content: systemPrompt
        });
      }

      // Add user message
      history.push({
        role: 'user',
        content: message
      });

      // Get completion with timeout
      const completionPromise = zai.chat.completions.create({
        messages: history,
        thinking: { type: 'disabled' }
      });

      // 30 second timeout (increased for better responses)
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('AI timeout')), 30000);
      });

      const completion = await Promise.race([completionPromise, timeoutPromise]);

      if (!completion) {
        throw new Error('Empty completion');
      }

      const aiResponse = completion.choices[0]?.message?.content;

      if (!aiResponse) {
        throw new Error('Empty response from AI');
      }

      // Add AI response to history
      history.push({
        role: 'assistant',
        content: aiResponse
      });

      // Keep only last 20 messages (keep system prompt)
      if (history.length > 20) {
        history = [history[0], ...history.slice(-19)];
      }

      // Save updated history
      conversations.set(sessionId, history);

      console.log(`💬 AI Chat: session=${sessionId}, messages=${history.length - 1}, response_length=${aiResponse.length}`);

      return NextResponse.json({
        success: true,
        response: aiResponse,
        messageCount: history.length - 1
      });

    } catch (aiError: any) {
      console.error('❌ AI error, using fallback:', aiError?.message || aiError);

      // Use fallback response
      const fallbackReply = getFallbackReply(message);

      return NextResponse.json({
        success: true,
        response: fallbackReply,
        fallback: true
      });
    }

  } catch (error) {
    console.error('❌ Chat error:', error);

    // Return fallback instead of error
    const userMessage = typeof body === 'object' && body?.message ? body.message : '';
    const fallbackReply = getFallbackReply(userMessage);

    return NextResponse.json({
      success: true,
      response: fallbackReply,
      fallback: true
    });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (sessionId) {
    conversations.delete(sessionId);
  }

  return NextResponse.json({ success: true, message: 'Conversation cleared' });
}
