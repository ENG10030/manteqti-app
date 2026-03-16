import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// Store conversations in memory (use database in production)
const conversations = new Map<string, Array<{ role: 'assistant' | 'user'; content: string }>>();

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const zai = await getZAI();

    // Get or create conversation history
    let history = conversations.get(sessionId) || [
      {
        role: 'assistant' as const,
        content: `أنت مساعد ذكي متخصص في العقارات والشقق في مصر. مهمتك مساعدة المستخدمين في:
- البحث عن الشقق المناسبة لاحتياجاتهم
- الإجابة على أسئلة حول الأسعار والمناطق
- تقديم نصائح حول الإيجار والشراء
- شرح تفاصيل العقارات والمميزات
- مساعدة في التواصل مع المالكين

أجب باللغة العربية دائماً. كن ودوداً ومحترفاً. إذا سُئلت عن شيء خارج نطاق العقارات، وجه المحادثة بلطف نحو مجال تخصصك.`
      }
    ];

    // Add user message
    history.push({
      role: 'user',
      content: message
    });

    // Get completion
    const completion = await zai.chat.completions.create({
      messages: history,
      thinking: { type: 'disabled' }
    });

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
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process message'
    }, { status: 500 });
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
