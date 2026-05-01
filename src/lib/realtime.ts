// Real-time notification helper
// Sends events to the Socket.io mini-service to broadcast to all connected clients

const REALTIME_SERVICE_URL = process.env.REALTIME_SERVICE_URL || 'http://localhost:3005';

let isNotifying = false;

/**
 * Notify all connected clients about a change.
 * This is fire-and-forget - errors are logged but don't block the API response.
 */
export async function notifyRealtime(event: string, payload?: any) {
  // Skip in test/build environments
  if (typeof window !== 'undefined') return;
  if (process.env.NODE_ENV === 'test') return;

  // Prevent stack overflow if notification triggers another notification
  if (isNotifying) return;
  isNotifying = true;

  try {
    await fetch(`${REALTIME_SERVICE_URL}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, payload }),
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });
  } catch (err) {
    // Silent fail - realtime is optional, don't break main functionality
    console.log(`[Realtime] Notification skipped (${event}): service not available`);
  } finally {
    isNotifying = false;
  }
}

/**
 * Notify that apartments data has changed
 */
export function notifyApartmentsChanged(event: 'created' | 'updated' | 'deleted' | 'approved', apartmentId?: string) {
  notifyRealtime(`apartment-${event}`, { apartmentId });
}

/**
 * Notify that messages have changed
 */
export function notifyMessagesChanged(userId?: string) {
  notifyRealtime('message-sent', { userId });
}
