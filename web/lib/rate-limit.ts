/**
 * Distributed rate limiter using Upstash Redis for production.
 * Falls back to in-memory for development or when Redis isn't configured.
 *
 * Setup for production:
 * 1. Create an Upstash Redis database at https://upstash.com
 * 2. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to your environment
 *
 * Without Redis configured, the in-memory fallback works but won't share state
 * across serverless instances (each instance has its own rate limit counter).
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ============================================================================
// UPSTASH REDIS RATE LIMITER (PRODUCTION)
// ============================================================================

let redis: Redis | null = null;
let upstashRateLimiters: Map<string, Ratelimit> | null = null;

// Initialize Redis connection if environment variables are set
function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    redis = new Redis({ url, token });
    return redis;
  }

  return null;
}

// Get or create an Upstash rate limiter for a specific config
function getUpstashRateLimiter(configKey: string, config: RateLimitConfig): Ratelimit | null {
  const redisClient = getRedis();
  if (!redisClient) return null;

  if (!upstashRateLimiters) {
    upstashRateLimiters = new Map();
  }

  if (!upstashRateLimiters.has(configKey)) {
    upstashRateLimiters.set(
      configKey,
      new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(config.limit, `${config.windowSec} s`),
        prefix: `ratelimit:${configKey}`,
        analytics: true,
      })
    );
  }

  return upstashRateLimiters.get(configKey) || null;
}

// ============================================================================
// IN-MEMORY RATE LIMITER (DEVELOPMENT/FALLBACK)
// ============================================================================

type RateLimitEntry = {
  count: number;
  resetTime: number;
};

// In-memory store - resets on server restart
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

// ============================================================================
// TYPES AND CONFIGURATION
// ============================================================================

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

// ============================================================================
// CORE RATE LIMIT FUNCTIONS
// ============================================================================

/**
 * Check and update rate limit for a given identifier.
 * Uses Upstash Redis in production, falls back to in-memory.
 *
 * @param identifier - Unique identifier (IP, user ID, or combination)
 * @param config - Rate limit configuration
 * @param configKey - Key to identify which rate limit config (for Upstash caching)
 * @returns Rate limit result with success status and metadata
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
  configKey: string = "default"
): Promise<RateLimitResult> {
  // Try Upstash first
  const upstashLimiter = getUpstashRateLimiter(configKey, config);

  if (upstashLimiter) {
    try {
      const result = await upstashLimiter.limit(identifier);
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        resetTime: result.reset,
      };
    } catch (error) {
      // Log error but don't fail - fall back to in-memory
      console.warn("Upstash rate limit error, falling back to in-memory:", error);
    }
  }

  // Fall back to in-memory
  return checkRateLimitInMemory(identifier, config);
}

/**
 * In-memory rate limit check (synchronous, for fallback)
 */
function checkRateLimitInMemory(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupExpiredEntries();

  const now = Date.now();
  const windowMs = config.windowSec * 1000;
  const key = `${config.limit}_${config.windowSec}:${identifier}`;

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

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

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
 *   const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.standard);
 *   if (rateLimitResult) return rateLimitResult;
 *
 *   // ... rest of handler
 * }
 * ```
 */
export async function applyRateLimit(
  request: Request,
  config: RateLimitConfig,
  identifier?: string
): Promise<Response | null> {
  const id = identifier || getClientIdentifier(request);

  // Derive config key from the config values
  const configKey = `${config.limit}_${config.windowSec}`;

  const result = await checkRateLimit(id, config, configKey);

  if (!result.success) {
    return rateLimitResponse(result);
  }

  return null;
}
