// Real-time notification helper
// Sends events to the Socket.io mini-service to broadcast to all connected clients

const REALTIME_SERVICE_URL = process.env.REALTIME_SERVICE_URL || 'http://localhost:3005';

let isNotifying = false;
let realtimeAvailable: boolean | null = null; // null = not checked yet

/**
 * Notify all connected clients about a change.
 * This is fire-and-forget - errors are logged but don't block the API response.
 */
export async function notifyRealtime(event: string, payload?: any) {
  // Skip in test/build/browser environments
  if (typeof window !== 'undefined') return;
  if (process.env.NODE_ENV === 'test') return;

  // Skip if we already know the service is not available (avoid repeated failed requests)
  if (realtimeAvailable === false) return;

  // Prevent stack overflow if notification triggers another notification
  if (isNotifying) return;
  isNotifying = true;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    const res = await fetch(`${REALTIME_SERVICE_URL}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, payload }),
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (res.ok) {
      realtimeAvailable = true;
    } else {
      realtimeAvailable = false;
      console.log(`[Realtime] Service returned ${res.status}, disabling notifications`);
    }
  } catch (err) {
    // Mark as unavailable after first failure to avoid repeated attempts
    if (realtimeAvailable === null) {
      console.log(`[Realtime] Notification service not available (${REALTIME_SERVICE_URL}), notifications disabled`);
    }
    realtimeAvailable = false;
  } finally {
    isNotifying = false;
  }
}

/**
 * Notify that apartments data has changed
 */
export function notifyApartmentsChanged(event: 'created' | 'updated' | 'deleted' | 'approved' | 'rejected' | 'featured', apartmentId?: string) {
  notifyRealtime(`apartment-${event}`, { apartmentId });
}

/**
 * Notify that messages have changed
 */
export function notifyMessagesChanged(userId?: string) {
  notifyRealtime('message-sent', { userId });
}
