import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// Store conversations in memory
const conversations = new Map<string, Array<{ role: 'assistant' | 'user'; content: string }>>();

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// System prompt for real estate assistant
const SYSTEM_PROMPT = `أنت مساعد ذكي متخصص في العقارات والشقق في مصر. اسمك "منطقتي".

مهمتك مساعدة المستخدمين في:
- البحث عن الشقق المناسبة لاحتياجاتهم
- الإجابة على أسئلة حول الأسعار والمناطق
- تقديم نصائح حول الإيجار والشراء
- شرح تفاصيل العقارات والمميزات

قواعد مهمة:
1. أجب باللغة العربية دائماً
2. كن ودوداً ومحترفاً
3. قدم معلومات مفيدة ومختصرة
4. استخدم الرموز التعبيرية`;

// Fallback responses for when AI is unavailable
const fallbackResponses: { keywords: string[]; reply: string }[] = [
  {
    keywords: ['مرحبا', 'اهلا', 'السلام', 'صباح', 'مساء'],
    reply: 'أهلاً بك! 👋 أنا مساعدك الذكي في منطقتي. كيف يمكنني مساعدتك اليوم؟'
  },
  {
    keywords: ['شقة', 'شقق'],
    reply: '🏠 لدينا شقق متنوعة للإيجار والبيع!\n\nيمكنني مساعدتك في:\n• البحث حسب المنطقة\n• تحديد الميزانية\n• عدد الغرف المطلوب'
  },
  {
    keywords: ['إيجار', 'ايجار', 'للإيجار'],
    reply: '🏠 شقق للإيجار متاحة!\n\nالمناطق المتاحة:\n• مدينة نصر\n• التجمع الخامس\n• المعادي\n• المهندسين'
  },
  {
    keywords: ['بيع', 'للبيع', 'شراء'],
    reply: '💰 عقارات ممتازة للبيع!\n\nأسعارنا تبدأ من:\n• شقق: 500,000 ج.م\n• فيلات: 3,000,000 ج.م'
  },
  {
    keywords: ['سعر', 'أسعار', 'كم', 'بكام'],
    reply: '💵 أسعارنا متنوعة:\n\n📋 للإيجار:\n• استوديو: 2,500 - 5,000 ج.م/شهر\n• 2 غرفة: 4,000 - 8,000 ج.م/شهر\n• 3 غرف: 6,000 - 15,000 ج.م/شهر'
  },
  {
    keywords: ['شكرا', 'شكراً', 'مشكور'],
    reply: 'العفو! 😊 سعيد بمساعدتك. إذا احتجت أي شيء آخر، أنا هنا دائماً! 🏠'
  }
];

const defaultReply = `🏠 أهلاً بك في منطقتي!

يمكنني مساعدتك في:
• البحث عن شقق للإيجار أو البيع
• معرفة الأسعار والمناطق
• الإجابة على استفساراتك

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
  let body: { sessionId?: string; message?: string } = {};
  
  try {
    body = await request.json();
    const { sessionId, message } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ success: true, response: defaultReply });
    }

    // Try to use AI SDK
    try {
      const zai = await getZAI();
      let history = conversations.get(sessionId || 'guest') || [
        { role: 'assistant' as const, content: SYSTEM_PROMPT }
      ];

      history.push({ role: 'user', content: message });

      const completion = await zai.chat.completions.create({
        messages: history,
        thinking: { type: 'disabled' }
      });

      const aiResponse = completion.choices[0]?.message?.content;

      if (aiResponse) {
        history.push({ role: 'assistant', content: aiResponse });
        if (history.length > 20) {
          history = [history[0], ...history.slice(-19)];
        }
        conversations.set(sessionId || 'guest', history);

        return NextResponse.json({
          success: true,
          response: aiResponse,
          messageCount: history.length - 1
        });
      }

      throw new Error('Empty response');

    } catch (aiError) {
      console.error('AI error, using fallback:', aiError);
      return NextResponse.json({
        success: true,
        response: getFallbackReply(message),
        fallback: true
      });
    }

  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({
      success: true,
      response: getFallbackReply(body?.message || ''),
      fallback: true
    });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  if (sessionId) conversations.delete(sessionId);
  return NextResponse.json({ success: true, message: 'Conversation cleared' });
}
