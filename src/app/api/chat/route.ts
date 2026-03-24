import { NextRequest, NextResponse } from 'next/server';

// Store conversations in memory (use database in production)
const conversations = new Map<string, Array<{ role: 'assistant' | 'user'; content: string }>>();

// Check if we're in development environment with SDK available
let zaiInstance: any = null;
let ZAI_AVAILABLE = false;

async function getZAI() {
  if (zaiInstance) return zaiInstance;
  
  try {
    // Dynamic import to avoid build errors when SDK is not available
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    zaiInstance = await ZAI.create();
    ZAI_AVAILABLE = true;
    return zaiInstance;
  } catch (e) {
    console.log('ZAI SDK not available, using fallback responses');
    ZAI_AVAILABLE = false;
    return null;
  }
}

// System prompt for real estate assistant
const SYSTEM_PROMPT = `أنت مساعد ذكي متخصص في العقارات والشقق في مصر. اسمك "منطقتي".

مهمتك مساعدة المستخدمين في:
- البحث عن الشقق المناسبة لاحتياجاتهم
- الإجابة على أسئلة حول الأسعار والمناطق
- تقديم نصائح حول الإيجار والشراء
- شرح تفاصيل العقارات والمميزات
- مساعدة في التواصل مع المالكين

قواعد مهمة:
1. أجب باللغة العربية دائماً
2. كن ودوداً ومحترفاً
3. قدم معلومات مفيدة ومختصرة
4. إذا سُئلت عن شيء خارج نطاق العقارات، وجه المحادثة بلطف نحو مجال تخصصك
5. استخدم الرموز التعبيرية لجعل الردود أكثر تفاعلاً`;

// Fallback responses for when AI is unavailable
const fallbackResponses: { keywords: string[]; reply: string }[] = [
  {
    keywords: ['مرحبا', 'اهلا', 'السلام', 'صباح', 'مساء'],
    reply: 'أهلاً بك! 👋 أنا مساعدك الذكي في منطقتي. كيف يمكنني مساعدتك اليوم في البحث عن عقار مناسب؟'
  },
  {
    keywords: ['شقة', 'شقق'],
    reply: '🏠 لدينا شقق متنوعة للإيجار والبيع!\n\nيمكنني مساعدتك في:\n• البحث حسب المنطقة\n• تحديد الميزانية\n• عدد الغرف المطلوب\n\nما هي احتياجاتك؟'
  },
  {
    keywords: ['إيجار', 'ايجار', 'للإيجار'],
    reply: '🏠 شقق للإيجار متاحة!\n\nالمناطق المتاحة:\n• مدينة نصر\n• التجمع الخامس\n• المعادي\n• وسط البلد\n\nما هي المنطقة المفضلة لك؟'
  },
  {
    keywords: ['بيع', 'للبيع', 'شراء'],
    reply: '💰 عقارات ممتازة للبيع!\n\nأسعارنا تبدأ من:\n• شقق: 500,000 ج.م\n• فيلات: 3,000,000 ج.م\n\nما هو ميزانيتك؟'
  },
  {
    keywords: ['سعر', 'أسعار', 'كم', 'بكام'],
    reply: '💵 أسعارنا متنوعة:\n\n📋 للإيجار:\n• استوديو: 2,500 - 5,000 ج.م/شهر\n• شقتين: 4,000 - 8,000 ج.م/شهر\n• ثلاث غرف: 6,000 - 15,000 ج.م/شهر\n\n📋 للبيع:\n• شقق: 500,000 - 3,000,000 ج.م\n• فيلات: 3,000,000 - 10,000,000 ج.م'
  },
  {
    keywords: ['مدينة نصر', 'مدينه نصر'],
    reply: '📍 مدينة نصر - منطقة ممتازة!\n\n🏗️ العقارات المتاحة:\n• شقق للإيجار: 3,500 - 12,000 ج.م\n• شقق للبيع: 800,000 - 2,500,000 ج.م\n\n📞 للتواصل: اتصل بنا لترتيب معاينة!'
  },
  {
    keywords: ['تجمع', 'التجمع'],
    reply: '📍 التجمع الخامس - أرقى المناطق!\n\n🏗️ العقارات المتاحة:\n• شقق للإيجار: 5,000 - 20,000 ج.م\n• شقق للبيع: 1,200,000 - 5,000,000 ج.م\n• فيلات: 4,000,000 - 15,000,000 ج.م'
  },
  {
    keywords: ['غرفة', 'غرف', 'سرير'],
    reply: '🛏️ شقق حسب عدد الغرف:\n\n• 1 غرفة (استوديو): مثالية للأفراد\n• 2 غرفة: مناسبة للأزواج\n• 3 غرف: مثالية للعائلات الصغيرة\n• 4+ غرف: للعائلات الكبيرة\n\nكم غرفة تحتاج؟'
  },
  {
    keywords: ['شكرا', 'شكراً', 'مشكور'],
    reply: 'العفو! 😊 سعيد بمساعدتك.\n\nإذا احتجت أي شيء آخر، أنا هنا دائماً! 🏠'
  }
];

const defaultReply = `🏠 أهلاً بك في منطقتي!

يمكنني مساعدتك في:
• البحث عن شقق للإيجار أو البيع
• معرفة الأسعار والمناطق
• الإجابة على استفساراتك

🔍 جرب أن تسألني عن:
• "شقق للإيجار"
• "أسعار في مدينة نصر"
• "فيلا للبيع"

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

      if (!zai || !ZAI_AVAILABLE) {
        // Use fallback response when SDK is not available
        const fallbackReply = getFallbackReply(message);
        return NextResponse.json({
          success: true,
          response: fallbackReply,
          fallback: true
        });
      }

      // Get or create conversation history
      let history = conversations.get(sessionId) || [
        {
          role: 'assistant' as const,
          content: SYSTEM_PROMPT
        }
      ];

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

      // 15 second timeout
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('AI timeout')), 15000);
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

      // Keep only last 20 messages to avoid token limits
      if (history.length > 20) {
        history = [history[0], ...history.slice(-19)];
      }

      // Save updated history
      conversations.set(sessionId, history);

      return NextResponse.json({
        success: true,
        response: aiResponse,
        messageCount: history.length - 1
      });

    } catch (aiError) {
      console.error('AI error, using fallback:', aiError);
      
      // Use fallback response
      const fallbackReply = getFallbackReply(message);
      
      return NextResponse.json({
        success: true,
        response: fallbackReply,
        fallback: true
      });
    }

  } catch (error) {
    console.error('Chat error:', error);
    
    // Return fallback instead of error
    const message = typeof body === 'object' && body?.message ? body.message : '';
    const fallbackReply = getFallbackReply(message);
    
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
