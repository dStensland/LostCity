import { Redis } from "@upstash/redis";

type MemoryCacheEntry = {
  expiresAt: number;
  value: string;
};

const memoryCache = new Map<string, MemoryCacheEntry>();
const inFlightLoads = new Map<string, Promise<unknown>>();
let redisClient: Redis | null | undefined;
const SHARED_CACHE_READ_TIMEOUT_MS = Number.parseInt(
  process.env.SHARED_CACHE_READ_TIMEOUT_MS || "80",
  10,
);
const SHARED_CACHE_WRITE_TIMEOUT_MS = Number.parseInt(
  process.env.SHARED_CACHE_WRITE_TIMEOUT_MS || "120",
  10,
);

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    redisClient = null;
    return null;
  }

  try {
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch {
    redisClient = null;
    return null;
  }
}

function cleanupExpiredMemoryEntries(): void {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt <= now) {
      memoryCache.delete(key);
    }
  }
}

function trimMemoryCache(maxEntries: number): void {
  if (memoryCache.size <= maxEntries) return;

  const overflow = memoryCache.size - maxEntries;
  let removed = 0;
  for (const key of memoryCache.keys()) {
    memoryCache.delete(key);
    removed += 1;
    if (removed >= overflow) break;
  }
}

function setMemoryValue(
  namespacedKey: string,
  serializedValue: string,
  ttlMs: number,
  maxEntries: number,
): void {
  cleanupExpiredMemoryEntries();
  memoryCache.set(namespacedKey, {
    value: serializedValue,
    expiresAt: Date.now() + ttlMs,
  });
  trimMemoryCache(maxEntries);
}

function getMemoryValue(namespacedKey: string): string | null {
  const entry = memoryCache.get(namespacedKey);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(namespacedKey);
    return null;
  }

  return entry.value;
}

function buildKey(namespace: string, key: string): string {
  return `${namespace}:${key}`;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`shared-cache timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

export async function getSharedCacheJson<T>(
  namespace: string,
  key: string,
): Promise<T | null> {
  const namespacedKey = buildKey(namespace, key);
  const memoryValue = getMemoryValue(namespacedKey);
  if (memoryValue) {
    try {
      return JSON.parse(memoryValue) as T;
    } catch {
      return null;
    }
  }

  const redis = getRedisClient();
  if (redis) {
    try {
      const cached = await withTimeout(
        redis.get<string>(namespacedKey),
        SHARED_CACHE_READ_TIMEOUT_MS,
      );
      if (typeof cached === "string") {
        // Promote redis hit to memory for fast local reads.
        setMemoryValue(namespacedKey, cached, 60 * 1000, 2000);
        return JSON.parse(cached) as T;
      }
    } catch {
      // Fall through to in-memory cache.
    }
  }
  return null;
}

export async function setSharedCacheJson<T>(
  namespace: string,
  key: string,
  value: T,
  ttlMs: number,
  options?: { maxEntries?: number },
): Promise<void> {
  const namespacedKey = buildKey(namespace, key);
  const maxEntries = options?.maxEntries ?? 300;
  const serialized = JSON.stringify(value);

  setMemoryValue(namespacedKey, serialized, ttlMs, maxEntries);

  const redis = getRedisClient();
  if (!redis) return;

  try {
    const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
    await withTimeout(
      redis.set(namespacedKey, serialized, { ex: ttlSeconds }),
      SHARED_CACHE_WRITE_TIMEOUT_MS,
    );
  } catch {
    // Ignore redis write failures; memory cache already has the value.
  }
}

export async function getOrSetSharedCacheJson<T>(
  namespace: string,
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
  options?: { maxEntries?: number },
): Promise<T> {
  const cached = await getSharedCacheJson<T>(namespace, key);
  if (cached !== null) {
    return cached;
  }

  const namespacedKey = buildKey(namespace, key);
  const existingLoad = inFlightLoads.get(namespacedKey);
  if (existingLoad) {
    return existingLoad as Promise<T>;
  }

  const loadPromise = (async () => {
    const loadedValue = await loader();
    await setSharedCacheJson(namespace, key, loadedValue, ttlMs, options);
    return loadedValue;
  })();

  inFlightLoads.set(namespacedKey, loadPromise);
  try {
    return await loadPromise;
  } finally {
    const currentLoad = inFlightLoads.get(namespacedKey);
    if (currentLoad === loadPromise) {
      inFlightLoads.delete(namespacedKey);
    }
  }
}
