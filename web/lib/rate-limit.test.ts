import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import {
  applyRateLimit,
  applyDailyQuota,
  checkRateLimit,
  getClientIdentifier,
  RATE_LIMITS,
  rateLimitResponse,
} from "./rate-limit";

// Mock Upstash to ensure we test in-memory fallback
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(),
}));

describe("rate-limit", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // Clear environment to ensure in-memory fallback
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.REQUIRE_DISTRIBUTED_RATE_LIMIT;
    process.env.NODE_ENV = "test";
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe("RATE_LIMITS", () => {
    it("has correct configuration for standard endpoints", () => {
      expect(RATE_LIMITS.standard).toEqual({ limit: 80, windowSec: 60 });
    });

    it("has correct configuration for auth endpoints", () => {
      expect(RATE_LIMITS.auth).toEqual({ limit: 10, windowSec: 60 });
    });

    it("has correct configuration for write endpoints", () => {
      expect(RATE_LIMITS.write).toEqual({ limit: 20, windowSec: 60 });
    });

    it("has correct configuration for expensive endpoints", () => {
      expect(RATE_LIMITS.expensive).toEqual({ limit: 20, windowSec: 60 });
    });

    it("has correct configuration for search endpoints", () => {
      expect(RATE_LIMITS.search).toEqual({ limit: 45, windowSec: 60 });
    });

    it("has strict defaults for high-cost endpoints", () => {
      expect(RATE_LIMITS.feed).toEqual({ limit: 40, windowSec: 60 });
      expect(RATE_LIMITS.proxy).toEqual({ limit: 50, windowSec: 60 });
      expect(RATE_LIMITS.aiExtract).toEqual({ limit: 6, windowSec: 60 });
      expect(RATE_LIMITS.invites).toEqual({ limit: 3, windowSec: 60 });
    });
  });

  describe("checkRateLimit (in-memory fallback)", () => {
    it("allows requests under the limit", async () => {
      const config = { limit: 5, windowSec: 60 };
      const identifier = `test-${Date.now()}-${Math.random()}`;

      const result = await checkRateLimit(identifier, config, "test");

      expect(result.success).toBe(true);
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(4);
      expect(result.source).toBe("memory");
    });

    it("decrements remaining count on each request", async () => {
      const config = { limit: 3, windowSec: 60 };
      const identifier = `test-decrement-${Date.now()}-${Math.random()}`;

      const result1 = await checkRateLimit(identifier, config, "test");
      expect(result1.remaining).toBe(2);

      const result2 = await checkRateLimit(identifier, config, "test");
      expect(result2.remaining).toBe(1);

      const result3 = await checkRateLimit(identifier, config, "test");
      expect(result3.remaining).toBe(0);
    });

    it("blocks requests over the limit", async () => {
      const config = { limit: 2, windowSec: 60 };
      const identifier = `test-block-${Date.now()}-${Math.random()}`;

      // Use up the limit
      await checkRateLimit(identifier, config, "test");
      await checkRateLimit(identifier, config, "test");

      // Third request should be blocked
      const result = await checkRateLimit(identifier, config, "test");

      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.source).toBe("memory");
    });

    it("tracks different identifiers separately", async () => {
      const config = { limit: 1, windowSec: 60 };
      const id1 = `user-1-${Date.now()}-${Math.random()}`;
      const id2 = `user-2-${Date.now()}-${Math.random()}`;

      // First request for user 1
      const result1 = await checkRateLimit(id1, config, "test");
      expect(result1.success).toBe(true);

      // First request for user 2 should still succeed
      const result2 = await checkRateLimit(id2, config, "test");
      expect(result2.success).toBe(true);

      // Second request for user 1 should be blocked
      const result3 = await checkRateLimit(id1, config, "test");
      expect(result3.success).toBe(false);
    });
  });

  describe("production distributed enforcement", () => {
    it("falls back to memory in production when distributed mode is not enabled", async () => {
      process.env.NODE_ENV = "production";
      const result = await checkRateLimit("prod-user", RATE_LIMITS.standard, "prod_test");

      expect(result.success).toBe(true);
      expect(result.source).toBe("memory");
    });

    it("fails closed when distributed mode is explicitly required", async () => {
      process.env.NODE_ENV = "production";
      process.env.REQUIRE_DISTRIBUTED_RATE_LIMIT = "true";
      const result = await checkRateLimit("prod-user-enforced", RATE_LIMITS.standard, "prod_enforced");

      expect(result.success).toBe(false);
      expect(result.source).toBe("unavailable");
      expect(result.reason).toBe("distributed_rate_limiter_required");
    });
  });

  describe("getClientIdentifier", () => {
    it("extracts IP from X-Forwarded-For header", () => {
      const request = new Request("https://example.com", {
        headers: {
          "x-forwarded-for": "203.0.113.195",
        },
      });

      expect(getClientIdentifier(request)).toBe("203.0.113.195");
    });

    it("uses first IP when X-Forwarded-For has multiple", () => {
      const request = new Request("https://example.com", {
        headers: {
          "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178",
        },
      });

      expect(getClientIdentifier(request)).toBe("203.0.113.195");
    });

    it("falls back to X-Real-IP header", () => {
      const request = new Request("https://example.com", {
        headers: {
          "x-real-ip": "192.168.1.1",
        },
      });

      expect(getClientIdentifier(request)).toBe("192.168.1.1");
    });

    it("returns 'unknown' when no IP headers present", () => {
      const request = new Request("https://example.com");

      expect(getClientIdentifier(request)).toBe("unknown");
    });

    it("prefers X-Forwarded-For over X-Real-IP", () => {
      const request = new Request("https://example.com", {
        headers: {
          "x-forwarded-for": "203.0.113.195",
          "x-real-ip": "192.168.1.1",
        },
      });

      expect(getClientIdentifier(request)).toBe("203.0.113.195");
    });
  });

  describe("rateLimitResponse", () => {
    it("returns 429 status", () => {
      const result = {
        success: false,
        limit: 10,
        remaining: 0,
        resetTime: Date.now() + 60000,
      };

      const response = rateLimitResponse(result);

      expect(response.status).toBe(429);
    });

    it("includes rate limit headers", () => {
      const resetTime = Date.now() + 60000;
      const result = {
        success: false,
        limit: 10,
        remaining: 0,
        resetTime,
      };

      const response = rateLimitResponse(result);

      expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
      expect(response.headers.get("X-RateLimit-Reset")).toBe(resetTime.toString());
    });

    it("includes Retry-After header", async () => {
      const result = {
        success: false,
        limit: 10,
        remaining: 0,
        resetTime: Date.now() + 30000,
      };

      const response = rateLimitResponse(result);
      const retryAfter = parseInt(response.headers.get("Retry-After") || "0", 10);

      // Should be approximately 30 seconds (allow some variance)
      expect(retryAfter).toBeGreaterThan(25);
      expect(retryAfter).toBeLessThanOrEqual(31);
    });

    it("returns JSON error body", async () => {
      const result = {
        success: false,
        limit: 10,
        remaining: 0,
        resetTime: Date.now() + 60000,
      };

      const response = rateLimitResponse(result);
      const body = await response.json();

      expect(body.error).toBe("Too many requests");
      expect(body.retryAfter).toBeDefined();
      expect(body.reason).toBeNull();
    });
  });

  describe("applyRateLimit helpers", () => {
    it("applies custom bucket keys for endpoint-scoped limits", async () => {
      const request = new Request("https://example.com");
      const identifier = `bucketed-${Date.now()}-${Math.random()}`;

      const allowed = await applyRateLimit(request, { limit: 1, windowSec: 60 }, identifier, {
        bucket: "endpoint:a",
      });
      expect(allowed).toBeNull();

      const blocked = await applyRateLimit(request, { limit: 1, windowSec: 60 }, identifier, {
        bucket: "endpoint:a",
      });
      expect(blocked?.status).toBe(429);

      // Different bucket should not be affected
      const allowedDifferentBucket = await applyRateLimit(
        request,
        { limit: 1, windowSec: 60 },
        identifier,
        { bucket: "endpoint:b" }
      );
      expect(allowedDifferentBucket).toBeNull();
    });

    it("supports daily quota helper", async () => {
      const request = new Request("https://example.com");
      const identifier = `daily-${Date.now()}-${Math.random()}`;

      const first = await applyDailyQuota(request, 1, identifier, { bucket: "test-daily" });
      expect(first).toBeNull();

      const second = await applyDailyQuota(request, 1, identifier, { bucket: "test-daily" });
      expect(second?.status).toBe(429);
    });
  });
});
