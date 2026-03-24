import { NextRequest, NextResponse } from 'next/server';

// Store conversations in memory
const conversations = new Map<string, Array<{ role: 'assistant' | 'user'; content: string }>>();

// Fallback responses
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
  try {
    const body = await request.json();
    const { message } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ 
        success: true, 
        response: defaultReply 
      });
    }

    const reply = getFallbackReply(message);
    
    return NextResponse.json({
      success: true,
      response: reply
    });

  } catch {
    return NextResponse.json({
      success: true,
      response: defaultReply
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