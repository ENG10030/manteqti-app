/**
 * Database-backed rate limiting for Vercel serverless environments.
 * 
 * Uses the existing OperationLog model to track attempts across all serverless instances.
 * This replaces in-memory rate limiting which doesn't work in serverless because each
 * request may hit a different instance.
 * 
 * Usage:
 *   const allowed = await checkRateLimit("dev-login", "ip", userIp, 5, 15 * 60);
 *   if (!allowed) return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
 *   // ... on failure:
 *   await recordFailedAttempt("dev-login", "ip", userIp, request);
 */

import { db } from "@/lib/db";

interface RateLimitConfig {
  maxAttempts: number;
  windowSeconds: number;
}

// Default configurations per endpoint
const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  "dev-login": { maxAttempts: 5, windowSeconds: 15 * 60 },      // 5 attempts per 15 min
  "forgot-password": { maxAttempts: 3, windowSeconds: 30 * 60 }, // 3 attempts per 30 min
  "verify-otp": { maxAttempts: 5, windowSeconds: 15 * 60 },      // 5 attempts per 15 min
  "request-otp": { maxAttempts: 3, windowSeconds: 5 * 60 },      // 3 requests per 5 min
  "login": { maxAttempts: 10, windowSeconds: 15 * 60 },          // 10 attempts per 15 min
};

/**
 * Check if a request should be rate limited.
 * @param endpoint - The endpoint identifier (e.g., "dev-login", "forgot-password")
 * @param keyType - The key type for identifying the source ("ip" or "email")
 * @param keyValue - The actual IP address or email
 * @param maxAttempts - Max attempts allowed in the window (optional, uses config defaults)
 * @param windowSeconds - Window duration in seconds (optional, uses config defaults)
 * @returns true if allowed, false if rate limited
 */
export async function checkRateLimit(
  endpoint: string,
  keyType: string,
  keyValue: string,
  maxAttempts?: number,
  windowSeconds?: number
): Promise<boolean> {
  try {
    const config = RATE_LIMIT_CONFIGS[endpoint] || {};
    const max = maxAttempts || config.maxAttempts || 5;
    const window = windowSeconds || config.windowSeconds || 15 * 60;
    
    const action = `rate-limit:${endpoint}`;
    const since = new Date(Date.now() - window * 1000);
    
    // Count recent attempts from this source
    const count = await db.operationLog.count({
      where: {
        action,
        entityType: keyType,
        entityId: keyValue,
        createdAt: { gte: since },
      },
    });
    
    return count < max;
  } catch (error) {
    // If DB is down, allow the request (fail open for availability)
    // The password is still checked, so security isn't compromised
    console.error(`Rate limit check failed for ${endpoint}:`, error);
    return true;
  }
}

/**
 * Record a failed attempt in the database.
 * @param endpoint - The endpoint identifier
 * @param keyType - "ip" or "email"
 * @param keyValue - The actual IP or email
 * @param request - The Request object (optional, for IP/user-agent extraction)
 * @param details - Additional details to log (optional)
 */
export async function recordFailedAttempt(
  endpoint: string,
  keyType: string,
  keyValue: string,
  request?: Request,
  details?: string
): Promise<void> {
  try {
    const action = `rate-limit:${endpoint}`;
    const ip = request
      ? (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
         request.headers.get("x-real-ip") ||
         "unknown")
      : "unknown";
    const userAgent = request?.headers.get("user-agent") || "unknown";
    
    await db.operationLog.create({
      data: {
        action,
        entityType: keyType,
        entityId: keyValue,
        ipAddress: ip,
        userAgent,
        details: details || `Failed ${endpoint} attempt`,
      },
    });
  } catch (error) {
    // Don't fail the request if logging fails
    console.error(`Failed to record rate limit attempt for ${endpoint}:`, error);
  }
}

/**
 * Get the client IP address from a request.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Clean up old rate limit records (call periodically or via cron).
 * Removes records older than 1 hour to prevent table bloat.
 */
export async function cleanupRateLimitRecords(): Promise<number> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const result = await db.operationLog.deleteMany({
      where: {
        action: { startsWith: "rate-limit:" },
        createdAt: { lt: oneHourAgo },
      },
    });
    
    return result.count;
  } catch (error) {
    console.error("Failed to cleanup rate limit records:", error);
    return 0;
  }
}
