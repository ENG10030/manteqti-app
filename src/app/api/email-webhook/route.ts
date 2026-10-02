import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyResendWebhook } from '@/lib/webhook-verify';

// Resend Webhook endpoint
// Receives email status notifications (delivered, bounced, complained, etc.)
// Configure in Resend Dashboard → Webhooks → add URL: https://your-domain.com/api/email-webhook


// Email event types we care about
const TRACKED_EVENTS = ['email.delivered', 'email.bounced', 'email.complained', 'email.delivery_failed', 'email.spam_reported'];

export async function POST(request: NextRequest) {
  try {
    // ⛔ SECURITY: تحقق Svix حقيقي — الدالة القديمة كانت معرفة ولا تُنادى أبداً
    const rawBody = await request.text();
    const verdict = await verifyResendWebhook(request, rawBody);
    if (!verdict.ok) {
      console.warn(`[Email Webhook] Rejected: ${verdict.reason}`);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

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
            action: `EMAIL_${status.toUpperCase()}`,
            userId: user.id,
            userName: toEmail || 'unknown',
            userEmail: fromEmail || null,
            reason: JSON.stringify({
              event: eventType,
              entityType: 'EmailEvent',
              entityId: emailId || 'unknown',
              email: toEmail,
              from: fromEmail,
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
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
