/**
 * Simple in-memory rate limiter for API routes.
 *
 * For production at scale, consider using:
 * - @upstash/ratelimit with Redis
 * - Vercel KV
 * - Cloudflare Rate Limiting
 *
 * This implementation is suitable for single-instance deployments
 * and provides basic protection against abuse.
 */

type RateLimitEntry = {
  count: number;
  resetTime: number;
};

// In-memory store - resets on server restart
// For multi-instance deployments, use Redis
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

export type RateLimitConfig = {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSec: number;
};

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
};

/**
 * Check and update rate limit for a given identifier.
 *
 * @param identifier - Unique identifier (IP, user ID, or combination)
 * @param config - Rate limit configuration
 * @returns Rate limit result with success status and metadata
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupExpiredEntries();

  const now = Date.now();
  const windowMs = config.windowSec * 1000;
  const key = `${identifier}`;

  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    // Start a new window
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(key, newEntry);

    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      resetTime: newEntry.resetTime,
    };
  }

  // Within existing window
  if (entry.count >= config.limit) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  // Increment count
  entry.count++;

  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Get client identifier from request.
 * Uses X-Forwarded-For header (set by reverse proxies/Vercel) or falls back to a default.
 */
export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs, use the first one
    return forwarded.split(",")[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  // Fallback - in production this should rarely happen
  return "unknown";
}

/**
 * Standard rate limit configurations for different endpoint types.
 */
export const RATE_LIMITS = {
  // General API endpoints - 100 requests per minute
  standard: { limit: 100, windowSec: 60 } as RateLimitConfig,

  // Read-heavy endpoints (events, search) - 200 requests per minute
  read: { limit: 200, windowSec: 60 } as RateLimitConfig,

  // Write endpoints (RSVP, follow) - 30 requests per minute
  write: { limit: 30, windowSec: 60 } as RateLimitConfig,

  // Auth-related endpoints - 10 requests per minute (prevent brute force)
  auth: { limit: 10, windowSec: 60 } as RateLimitConfig,

  // Expensive endpoints (feed, trending) - 30 requests per minute
  expensive: { limit: 30, windowSec: 60 } as RateLimitConfig,

  // Search endpoints - 60 requests per minute
  search: { limit: 60, windowSec: 60 } as RateLimitConfig,
} as const;

/**
 * Create rate limit error response with proper headers.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);

  return new Response(
    JSON.stringify({
      error: "Too many requests",
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": result.limit.toString(),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": result.resetTime.toString(),
        "Retry-After": retryAfter.toString(),
      },
    }
  );
}

/**
 * Middleware helper for rate limiting in API routes.
 * Returns null if allowed, or a Response if rate limited.
 *
 * @example
 * ```ts
 * export async function GET(request: Request) {
 *   const rateLimitResult = applyRateLimit(request, RATE_LIMITS.standard);
 *   if (rateLimitResult) return rateLimitResult;
 *
 *   // ... rest of handler
 * }
 * ```
 */
export function applyRateLimit(
  request: Request,
  config: RateLimitConfig,
  identifier?: string
): Response | null {
  const id = identifier || getClientIdentifier(request);
  const result = checkRateLimit(id, config);

  if (!result.success) {
    return rateLimitResponse(result);
  }

  return null;
}
