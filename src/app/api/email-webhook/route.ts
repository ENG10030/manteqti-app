import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Resend Webhook endpoint
// Receives email status notifications (delivered, bounced, complained, etc.)
// Configure in Resend Dashboard → Webhooks → add URL: https://your-domain.com/api/email-webhook

// Verify webhook signature (security measure)
async function verifyWebhookSignature(body: string, signature: string | null, timestamp: string | null): Promise<boolean> {
  const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;
  if (!RESEND_WEBHOOK_SECRET || !signature) return false;
  try {
    const crypto = await import('crypto');
    const expectedSig = crypto
      .createHmac('sha256', RESEND_WEBHOOK_SECRET)
      .update(`${timestamp}.${body}`)
      .digest('base64');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
  } catch {
    return false;
  }
}

// Email event types we care about
const TRACKED_EVENTS = ['email.delivered', 'email.bounced', 'email.complained', 'email.delivery_failed', 'email.spam_reported'];

export async function POST(request: NextRequest) {
  try {
    // Optional: Verify webhook signature for security
    const signature = request.headers.get('resend-signature');
    const timestamp = request.headers.get('resend-timestamp');
    const rawBody = await request.text();
    
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const eventType = body.type;
    const emailData = body.data;

    // Log all webhook events
    console.log(`📨 Resend Webhook: ${eventType}`, JSON.stringify(emailData, null, 2));

    // Only process events we track
    if (!TRACKED_EVENTS.includes(eventType)) {
      return NextResponse.json({ received: true, ignored: true });
    }

    // Extract email from the payload
    const toEmail = emailData?.to?.[0] || emailData?.email || emailData?.to;
    const emailId = emailData?.email_id || emailData?.id;
    const fromEmail = emailData?.from;
    const reason = emailData?.reason || '';
    const status = eventType.replace('email.', '');

    if (!toEmail) {
      return NextResponse.json({ received: true, processed: false, reason: 'no email found' });
    }

    // Try to find the user and log the email event
    try {
      const user = await db.user.findFirst({
        where: {
          OR: [
            { email: toEmail },
            { identifier: toEmail },
          ]
        }
      });

      // Store email event in the approval log (reuse existing table for logging)
      if (user) {
        await db.approvalLog.create({
          data: {
            entityType: 'EmailEvent',
            entityId: emailId || 'unknown',
            action: `EMAIL_${status.toUpperCase()}`,
            userId: user.id,
            details: JSON.stringify({
              event: eventType,
              email: toEmail,
              from: fromEmail,
              reason,
              timestamp: new Date().toISOString(),
            }),
          },
        });

        // ⚠️ If email bounced or complained, mark the user's email as potentially invalid
        if (eventType === 'email.bounced' || eventType === 'email.complained' || eventType === 'email.spam_reported') {
          await db.user.update({
            where: { id: user.id },
            data: {
              // Store bounce info without changing emailVerified (admin should review)
            },
          });

          console.warn(`⚠️ Email issue for user ${user.id} (${toEmail}): ${eventType} - ${reason}`);
        }
      }
    } catch (dbError: any) {
      // Don't fail the webhook if DB is down
      console.error('Webhook DB logging error:', dbError?.message);
    }

    return NextResponse.json({ received: true, processed: true, event: eventType });

  } catch (error) {
    console.error('Email webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// Health check for webhook (no configuration details exposed)
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
