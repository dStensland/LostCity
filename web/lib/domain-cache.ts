/**
 * Domain Cache - In-memory caching for custom domain lookups
 *
 * This provides fast lookups for custom domain -> portal slug mapping.
 * Uses a simple Map with TTL-based expiration.
 */

type CacheEntry = {
  slug: string | null;
  expiresAt: number;
};

// In-memory cache for domain -> slug mapping
const domainCache = new Map<string, CacheEntry>();

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Get a cached domain mapping
 * @returns slug if cached and not expired, undefined if not in cache or expired
 */
export function getCachedDomain(domain: string): string | null | undefined {
  const entry = domainCache.get(domain.toLowerCase());

  if (!entry) {
    return undefined; // Not in cache
  }

  if (Date.now() > entry.expiresAt) {
    // Expired - remove from cache
    domainCache.delete(domain.toLowerCase());
    return undefined;
  }

  return entry.slug; // null means verified not found, string is the slug
}

/**
 * Cache a domain mapping
 * @param domain The custom domain
 * @param slug The portal slug (null if domain doesn't map to any portal)
 */
export function setCachedDomain(domain: string, slug: string | null): void {
  domainCache.set(domain.toLowerCase(), {
    slug,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Invalidate a cached domain mapping
 * Call this when a portal's custom_domain is updated
 */
export function invalidateDomainCache(domain: string): void {
  domainCache.delete(domain.toLowerCase());
}

/**
 * Clear the entire domain cache
 * Use sparingly, typically only needed for testing
 */
export function clearDomainCache(): void {
  domainCache.clear();
}

/**
 * Get cache stats for debugging
 */
export function getDomainCacheStats(): { size: number; domains: string[] } {
  return {
    size: domainCache.size,
    domains: Array.from(domainCache.keys()),
  };
}
