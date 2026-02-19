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

const DISTRIBUTED_BACKEND_RETRY_AFTER_SEC = 60;
const UPSTASH_RATE_LIMIT_TIMEOUT_MS = Number.parseInt(
  process.env.UPSTASH_RATE_LIMIT_TIMEOUT_MS || "250",
  10
);

function requiresDistributedRateLimit(): boolean {
  return process.env.REQUIRE_DISTRIBUTED_RATE_LIMIT === "true";
}

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

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
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
  source: "upstash" | "memory" | "unavailable";
  reason?: "distributed_rate_limiter_required" | "distributed_rate_limiter_error";
};

/**
 * Standard rate limit configurations for different endpoint types.
 */
export const RATE_LIMITS = {
  // General API endpoints - 80 requests per minute
  standard: { limit: 80, windowSec: 60 } as RateLimitConfig,

  // Read-heavy endpoints (events, search) - 120 requests per minute
  read: { limit: 120, windowSec: 60 } as RateLimitConfig,

  // Write endpoints (RSVP, follow) - 20 requests per minute
  write: { limit: 20, windowSec: 60 } as RateLimitConfig,

  // Auth-related endpoints - 10 requests per minute (prevent brute force)
  auth: { limit: 10, windowSec: 60 } as RateLimitConfig,

  // Expensive endpoints (feed, trending) - 20 requests per minute
  expensive: { limit: 20, windowSec: 60 } as RateLimitConfig,

  // Search endpoints - 45 requests per minute
  search: { limit: 45, windowSec: 60 } as RateLimitConfig,

  // Feed endpoints can be noisy under bot traffic
  feed: { limit: 40, windowSec: 60 } as RateLimitConfig,

  // Image proxy can be used for bandwidth abuse
  proxy: { limit: 50, windowSec: 60 } as RateLimitConfig,

  // OpenAI-backed image extraction should be tightly controlled
  aiExtract: { limit: 6, windowSec: 60 } as RateLimitConfig,

  // Outbound email sends
  invites: { limit: 3, windowSec: 60 } as RateLimitConfig,
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
      const result = await withTimeout(
        upstashLimiter.limit(identifier),
        UPSTASH_RATE_LIMIT_TIMEOUT_MS,
        "Upstash rate limit check"
      );
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        resetTime: result.reset,
        source: "upstash",
      };
    } catch (error) {
      // Fail closed in production unless explicitly overridden.
      if (requiresDistributedRateLimit()) {
        console.error("Upstash rate limit error in production:", error);
        return {
          success: false,
          limit: config.limit,
          remaining: 0,
          resetTime: Date.now() + DISTRIBUTED_BACKEND_RETRY_AFTER_SEC * 1000,
          source: "unavailable",
          reason: "distributed_rate_limiter_error",
        };
      }

      // In non-production, falling back is acceptable for local development.
      console.warn("Upstash rate limit error, falling back to in-memory:", error);
      return checkRateLimitInMemory(identifier, config, configKey);
    }
  }

  if (requiresDistributedRateLimit()) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      resetTime: Date.now() + DISTRIBUTED_BACKEND_RETRY_AFTER_SEC * 1000,
      source: "unavailable",
      reason: "distributed_rate_limiter_required",
    };
  }

  // Fall back to in-memory
  return checkRateLimitInMemory(identifier, config, configKey);
}

/**
 * In-memory rate limit check (synchronous, for fallback)
 */
function checkRateLimitInMemory(
  identifier: string,
  config: RateLimitConfig,
  scopeKey: string = "default"
): RateLimitResult {
  cleanupExpiredEntries();

  const now = Date.now();
  const windowMs = config.windowSec * 1000;
  const key = `${scopeKey}:${config.limit}_${config.windowSec}:${identifier}`;

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
      source: "memory",
    };
  }

  // Within existing window
  if (entry.count >= config.limit) {
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      resetTime: entry.resetTime,
      source: "memory",
    };
  }

  // Increment count
  entry.count++;

  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - entry.count,
    resetTime: entry.resetTime,
    source: "memory",
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
  const retryAfter = Math.max(1, Math.ceil((result.resetTime - Date.now()) / 1000));
  const isBackendUnavailable = result.source === "unavailable";

  return new Response(
    JSON.stringify({
      error: isBackendUnavailable
        ? "Rate limiting backend unavailable"
        : "Too many requests",
      retryAfter,
      reason: result.reason || null,
    }),
    {
      status: isBackendUnavailable ? 503 : 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": result.limit.toString(),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": result.resetTime.toString(),
        "X-RateLimit-Source": result.source,
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
  identifier?: string,
  options?: {
    bucket?: string;
    logContext?: string;
  }
): Promise<Response | null> {
  const id = identifier || getClientIdentifier(request);

  // Derive config key from the config values unless a custom endpoint bucket is provided.
  const configKey = options?.bucket || `${config.limit}_${config.windowSec}`;

  const result = await checkRateLimit(id, config, configKey);

  if (!result.success) {
    console.warn("Rate limit blocked request", {
      context: options?.logContext || "api",
      bucket: configKey,
      identifier: id,
      source: result.source,
      reason: result.reason || "limit_exceeded",
      limit: config.limit,
      windowSec: config.windowSec,
    });
    return rateLimitResponse(result);
  }

  return null;
}

/**
 * Optional daily quota helper for costly endpoints.
 * Uses UTC calendar day buckets to cap usage beyond burst/minute limits.
 */
export async function applyDailyQuota(
  request: Request,
  dailyLimit: number,
  identifier?: string,
  options?: {
    bucket?: string;
    logContext?: string;
  }
): Promise<Response | null> {
  if (!Number.isFinite(dailyLimit) || dailyLimit <= 0) {
    return null;
  }

  const day = new Date().toISOString().slice(0, 10); // UTC day bucket
  const bucketBase = options?.bucket || "daily";
  const bucket = `daily:${bucketBase}:${day}`;
  return applyRateLimit(
    request,
    { limit: dailyLimit, windowSec: 24 * 60 * 60 },
    identifier,
    { bucket, logContext: options?.logContext || bucketBase }
  );
}
