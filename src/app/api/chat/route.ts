import { NextRequest, NextResponse } from 'next/server';

// System prompt for real estate assistant
const SYSTEM_PROMPT = `أنت مساعد ذكي متخصص في العقارات والشقق في مصر. اسمك "منطقتي".

مهمتك مساعدة المستخدمين في:
- البحث عن الشقق المناسبة لاحتياجاتهم
- الإجابة على أسئلة حول الأسعار والمناطق
- تقديم نصائح حول الإيجار والشراء
- شرح تفاصيل العقارات والمميزات
- مساعدة في التواصل مع المالكين
- تقديم توصيات ذكية بناءً على احتياجات المستخدم

قواعد مهمة:
1. أجب باللغة العربية دائماً
2. كن ودوداً ومحترفاً
3. قدم معلومات مفيدة ومختصرة
4. استخدم الرموز التعبيرية لجعل الردود أكثر تفاعلية
5. إذا سُئلت عن شيء خارج نطاق العقارات، حاول ربطه بمجال العقارات أو وجه المحادثة بلطف`;

// Fallback responses for when AI is unavailable
const fallbackResponses: { keywords: string[]; reply: string }[] = [
  {
    keywords: ['مرحبا', 'اهلا', 'السلام', 'صباح', 'مساء', 'هاي', 'hello'],
    reply: 'أهلاً بك! 👋 أنا مساعدك الذكي في منطقتي. كيف يمكنني مساعدتك اليوم في البحث عن عقار مناسب؟'
  },
  {
    keywords: ['شقة', 'شقق', 'flat', 'apartment'],
    reply: '🏠 لدينا شقق متنوعة للإيجار والبيع!\n\nيمكنني مساعدتك في:\n• البحث حسب المنطقة\n• تحديد الميزانية\n• عدد الغرف المطلوب\n\nما هي احتياجاتك؟'
  },
  {
    keywords: ['إيجار', 'ايجار', 'للإيجار', 'rent'],
    reply: '🏠 شقق للإيجار متاحة!\n\nالمناطق المتاحة:\n• مدينة نصر\n• التجمع الخامس\n• المعادي\n• الشيخ زايد\n• أكتوبر\n\nما هي المنطقة المفضلة لك؟'
  },
  {
    keywords: ['بيع', 'للبيع', 'شراء', 'sale'],
    reply: '💰 عقارات ممتازة للبيع!\n\nأسعارنا تبدأ من:\n• شقق: 500,000 ج.م\n• فيلات: 3,000,000 ج.م\n\nما هو ميزانيتك؟'
  },
  {
    keywords: ['سعر', 'أسعار', 'كم', 'بكام', 'price'],
    reply: '💵 أسعارنا متنوعة:\n\n📋 للإيجار:\n• استوديو: 2,500 - 5,000 ج.م/شهر\n• شقتين: 4,000 - 8,000 ج.م/شهر\n• ثلاث غرف: 6,000 - 15,000 ج.م/شهر\n\n📋 للبيع:\n• شقق: 500,000 - 3,000,000 ج.م\n• فيلات: 3,000,000 - 10,000,000 ج.م'
  },
  {
    keywords: ['مدينة نصر', 'مدينه نصر', 'نصر'],
    reply: '📍 مدينة نصر - منطقة ممتازة!\n\n🏗️ العقارات المتاحة:\n• شقق للإيجار: 3,500 - 12,000 ج.م\n• شقق للبيع: 800,000 - 2,500,000 ج.م\n\n📞 للتواصل: تواصل معنا لترتيب معاينة!'
  },
  {
    keywords: ['تجمع', 'التجمع', 'fifth'],
    reply: '📍 التجمع الخامس - أرقى المناطق!\n\n🏗️ العقارات المتاحة:\n• شقق للإيجار: 5,000 - 20,000 ج.م\n• شقق للبيع: 1,200,000 - 5,000,000 ج.م\n• فيلات: 4,000,000 - 15,000,000 ج.م'
  },
  {
    keywords: ['معادي', 'المعادي', 'maadi'],
    reply: '📍 المعادي - منطقة راقية!\n\n🏗️ العقارات المتاحة:\n• شقق للإيجار: 4,000 - 15,000 ج.م\n• شقق للبيع: 900,000 - 4,000,000 ج.م\n\n🌳 مميزة بقربها من النيل والمرافق'
  },
  {
    keywords: ['غرفة', 'غرف', 'سرير', 'room'],
    reply: '🛏️ شقق حسب عدد الغرف:\n\n• 1 غرفة (استوديو): مثالية للأفراد\n• 2 غرفة: مناسبة للأزواج\n• 3 غرف: مثالية للعائلات الصغيرة\n• 4+ غرف: للعائلات الكبيرة\n\nكم غرفة تحتاج؟'
  },
  {
    keywords: ['شكرا', 'شكراً', 'مشكور', 'thanks'],
    reply: 'العفو! 😊 سعيد بمساعدتك.\n\nإذا احتجت أي شيء آخر، أنا هنا دائماً! 🏠'
  },
  {
    keywords: ['فيلا', 'فيلات', 'villa'],
    reply: '🏘️ فيلات فاخرة!\n\nالمناطق المتاحة:\n• التجمع الخامس: 4,000,000 - 20,000,000 ج.م\n• الشيخ زايد: 3,000,000 - 15,000,000 ج.م\n• أكتوبر: 2,500,000 - 10,000,000 ج.م\n\nما هي المنطقة المفضلة؟'
  },
  {
    keywords: ['تمليك', 'قسط', 'تقسيط'],
    reply: '🏦 خيارات التمليك والتقسيط!\n\nنوفر:\n• تقسيط بدون فوائد حتى 5 سنوات\n• دفعة مقدمة تبدأ من 10%\n• عقارات مطورة بمرافق كاملة\n\nتواصل معنا لمعرفة التفاصيل! 📞'
  },
  {
    keywords: ['نصيحة', 'نصائح', 'advice'],
    reply: '💡 نصائح مهمة عند شراء أو استئجار شقة:\n\n1. حدد ميزانيتك بوضوح\n2. اختر المنطقة المناسبة\n3. تحقق من المرافق القريبة\n4. قارن الأسعار في نفس المنطقة\n5. تأكد من صحة العقود\n6. زر الشقة قبل التعاقد\n\nهل تحتاج نصيحة محددة؟'
  }
];

const defaultReply = `🏠 أهلاً بك في منطقتي!

يمكنني مساعدتك في:
• البحث عن شقق للإيجار أو البيع 🏢
• معرفة الأسعار والمناطق 💰
• نصائح للشراء والإيجار 💡
• توصيات ذكية حسب احتياجك 🎯

🔍 جرب أن تسألني عن:
• "شقق للإيجار في المعادي"\n• "أسعار الفلل في التجمع"\n• "نصائح عند شراء شقة"

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

    // Build message history
    const history = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: message }
    ];

    // Try to use AI SDK
    try {
      const mod: any = await import('z-ai-web-dev-sdk').catch(() => null);
      
      if (mod?.default && typeof mod.default.create === 'function') {
        const zai = await mod.default.create();

        const completionPromise = zai.chat.completions.create({
          messages: history,
          thinking: { type: 'disabled' }
        });

        // 20 second timeout
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error('AI timeout')), 20000);
        });

        const completion = await Promise.race([completionPromise, timeoutPromise]);

        if (completion && completion.choices?.[0]?.message?.content) {
          return NextResponse.json({
            success: true,
            response: completion.choices[0].message.content,
            ai: true
          });
        }
      }
    } catch {
      // SDK not available, use fallback
    }

    // Fallback response when SDK is not available
    const fallbackReply = getFallbackReply(message);
    
    return NextResponse.json({
      success: true,
      response: fallbackReply,
      fallback: true
    });

  } catch (error) {
    console.error('Chat error:', error);
    
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
  return NextResponse.json({ success: true, message: 'Conversation cleared' });
}
