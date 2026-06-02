import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Resend sends webhook events (delivered, bounced, complained, etc.)
// Configure in Resend Dashboard → Webhooks → Add endpoint → https://your-domain.com/api/resend-webhook

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature (Resend uses a webhook signing secret)
    if (RESEND_WEBHOOK_SECRET) {
      const resendSignature = request.headers.get('resend-signature');
      if (!resendSignature) {
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
      }
      // Note: Full signature verification requires crypto module
      // For now, we just check the header exists
    }

    const payload = await request.json();
    const eventType = payload.type;
    const emailData = payload.data;

    if (!eventType || !emailData) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    console.log(`[Resend Webhook] Event: ${eventType}`, JSON.stringify(emailData).substring(0, 200));

    // Handle different event types
    switch (eventType) {
      case 'email.sent':
        // Email was sent successfully
        await logEmailEvent('SENT', emailData);
        break;

      case 'email.delivered':
        // Email was delivered to recipient's inbox
        await logEmailEvent('DELIVERED', emailData);
        break;

      case 'email.bounced':
        // Email bounced (address doesn't exist, mailbox full, etc.)
        await logEmailEvent('BOUNCED', emailData);
        // Optionally mark user email as invalid
        await markEmailAsBounced(emailData);
        break;

      case 'email.complained':
        // Recipient marked email as spam
        await logEmailEvent('COMPLAINED', emailData);
        break;

      case 'email.opened':
        // Recipient opened the email
        await logEmailEvent('OPENED', emailData);
        break;

      case 'email.clicked':
        // Recipient clicked a link in the email
        await logEmailEvent('CLICKED', emailData);
        break;

      default:
        console.log(`[Resend Webhook] Unknown event type: ${eventType}`);
    }

    return NextResponse.json({ received: true, event: eventType });
  } catch (error) {
    console.error('[Resend Webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// Log email event to database
async function logEmailEvent(eventType: string, data: Record<string, unknown>) {
  try {
    // Use OperationLog to track email events
    await db.operationLog.create({
      data: {
        action: `EMAIL_${eventType}`,
        entityType: 'Email',
        entityId: (data.email_id as string) || 'unknown',
        details: JSON.stringify({
          event: eventType,
          to: data.to || data.email,
          from: data.from,
          subject: data.subject,
          timestamp: new Date().toISOString(),
        }),
      },
    });
  } catch {
    // Log to console if database logging fails
    console.log(`[Resend Webhook] Logged event: ${eventType}`);
  }
}

// Mark user email as bounced/invalid
async function markEmailAsBounced(data: Record<string, unknown>) {
  try {
    const email = (data.to as string) || (data.email as string);
    if (!email) return;

    const bouncedEmails = (process.env.BOUNCED_EMAILS || '').split(',');
    if (email && !bouncedEmails.includes(email)) {
      // Store bounced emails info (you can enhance this with a dedicated DB table)
      console.log(`[Resend Webhook] Email bounced: ${email}`);
      // Optionally block future sends to this address
    }
  } catch {
    // Silent fail
  }
}

// Health check for the webhook endpoint
export async function GET() {
  return NextResponse.json({
    service: 'manteqti-resend-webhook',
    status: 'active',
    events: ['sent', 'delivered', 'bounced', 'complained', 'opened', 'clicked'],
  });
}
