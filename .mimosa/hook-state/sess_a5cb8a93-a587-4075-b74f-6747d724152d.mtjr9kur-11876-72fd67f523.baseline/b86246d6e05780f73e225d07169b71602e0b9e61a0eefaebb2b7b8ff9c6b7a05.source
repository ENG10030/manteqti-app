// Webhook utility for notifying the Render realtime service
// Used by API routes to broadcast real-time events to connected clients

const RENDER_WEBHOOK_URL = process.env.RENDER_WEBHOOK_URL || '';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'manteqti-webhook-secret-2024';

export async function broadcastEvent(event: string, data?: Record<string, unknown>) {
  if (!RENDER_WEBHOOK_URL) {
    // No Render service configured — skip silently
    return;
  }

  try {
    await fetch(RENDER_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify({ event, data: data ?? {} }),
      signal: AbortSignal.timeout(3000), // Don't block the API response
    });
  } catch {
    // Webhook failed — don't affect the API response
  }
}

// Pre-defined event types
export const WebhookEvents = {
  APARTMENTS_CHANGED: 'apartments-changed',
  MESSAGES_CHANGED: 'messages-changed',
  SETTINGS_UPDATED: 'settings-updated',
  USER_CHANGED: 'user-changed',          // user blocked/unblocked/approved/deleted
  PAYMENTS_CHANGED: 'payments-changed',  // payment status updated
  USERS_CHANGED: 'users-changed',
  NOTIFICATIONS_CHANGED: 'notifications-changed',
} as const;
