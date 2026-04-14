/**
 * Social Proof Utilities
 *
 * Fetches and enriches entities with social proof data (RSVPs, follows, recommendations).
 * Extracted from search.ts to break circular dependency with unified-search.ts.
 */

import { createServiceClient } from "./supabase/service";
import { createLogger } from "./logger";
import type { EventWithLocation } from "./event-search";
import { getSharedCacheJson, setSharedCacheJson } from "./shared-cache";

const logger = createLogger("social-proof");
const SOCIAL_PROOF_CACHE_TTL_MS = 30 * 1000;
const SOCIAL_PROOF_CACHE_MAX_ENTRIES = 200;
const SOCIAL_PROOF_CACHE_NAMESPACE = "social-proof:counts";
const socialProofEventCache = new Map<
  number,
  {
    expiresAt: number;
    counts: { going: number; interested: number; recommendations: number };
  }
>();
const socialProofCache = new Map<
  string,
  {
    expiresAt: number;
    counts: Array<
      [number, { going: number; interested: number; recommendations: number }]
    >;
  }
>();
const socialProofInFlight = new Map<
  string,
  Promise<Map<number, { going: number; interested: number; recommendations: number }>>
>();

function normalizeEventIds(eventIds: number[]): number[] {
  return Array.from(
    new Set(eventIds.filter((id) => Number.isFinite(id)).map((id) => Number(id))),
  ).sort((a, b) => a - b);
}

function buildSocialProofCacheKey(eventIds: number[]): string {
  return normalizeEventIds(eventIds).join(",");
}

function cloneCountsMap(
  counts: Map<number, { going: number; interested: number; recommendations: number }>,
): Map<number, { going: number; interested: number; recommendations: number }> {
  return new Map(
    Array.from(counts.entries()).map(([eventId, value]) => [eventId, { ...value }]),
  );
}

function getCachedSocialProofCounts(
  cacheKey: string,
): Map<number, { going: number; interested: number; recommendations: number }> | null {
  const cached = socialProofCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    socialProofCache.delete(cacheKey);
    return null;
  }
  return new Map(cached.counts.map(([eventId, value]) => [eventId, { ...value }]));
}

function setCachedSocialProofCounts(
  cacheKey: string,
  counts: Map<number, { going: number; interested: number; recommendations: number }>,
): void {
  socialProofCache.set(cacheKey, {
    expiresAt: Date.now() + SOCIAL_PROOF_CACHE_TTL_MS,
    counts: Array.from(counts.entries()).map(([eventId, value]) => [
      eventId,
      { ...value },
    ]),
  });

  if (socialProofCache.size > SOCIAL_PROOF_CACHE_MAX_ENTRIES) {
    const oldestKey = socialProofCache.keys().next().value;
    if (oldestKey) {
      socialProofCache.delete(oldestKey);
    }
  }
}

function getCachedSocialProofEventCounts(
  eventIds: number[],
): Map<number, { going: number; interested: number; recommendations: number }> {
  const counts = new Map<
    number,
    { going: number; interested: number; recommendations: number }
  >();

  for (const eventId of eventIds) {
    const cached = socialProofEventCache.get(eventId);
    if (!cached) continue;
    if (cached.expiresAt <= Date.now()) {
      socialProofEventCache.delete(eventId);
      continue;
    }
    counts.set(eventId, { ...cached.counts });
  }

  return counts;
}

function setCachedSocialProofEventCounts(
  counts: Map<number, { going: number; interested: number; recommendations: number }>,
): void {
  const expiresAt = Date.now() + SOCIAL_PROOF_CACHE_TTL_MS;

  for (const [eventId, value] of counts.entries()) {
    socialProofEventCache.set(eventId, {
      expiresAt,
      counts: { ...value },
    });
  }

  if (socialProofEventCache.size > SOCIAL_PROOF_CACHE_MAX_ENTRIES * 4) {
    const oldestKey = socialProofEventCache.keys().next().value;
    if (oldestKey !== undefined) {
      socialProofEventCache.delete(oldestKey);
    }
  }
}

type SerializedSocialProofCounts = Array<
  [number, { going: number; interested: number; recommendations: number }]
>;

function serializeCounts(
  counts: Map<number, { going: number; interested: number; recommendations: number }>,
): SerializedSocialProofCounts {
  return Array.from(counts.entries()).map(([eventId, value]) => [
    eventId,
    { ...value },
  ]);
}

function deserializeCounts(
  counts: SerializedSocialProofCounts,
): Map<number, { going: number; interested: number; recommendations: number }> {
  return new Map(counts.map(([eventId, value]) => [eventId, { ...value }]));
}

/**
 * Fetch social proof counts for a list of events using a single RPC call.
 */
export async function fetchSocialProofCounts(
  eventIds: number[]
): Promise<Map<number, { going: number; interested: number; recommendations: number }>> {
  const normalizedEventIds = normalizeEventIds(eventIds);
  if (normalizedEventIds.length === 0) {
    return new Map();
  }

  const cacheKey = buildSocialProofCacheKey(normalizedEventIds);
  const cachedCounts = getCachedSocialProofCounts(cacheKey);
  if (cachedCounts) {
    return cachedCounts;
  }

  const partialCachedCounts = getCachedSocialProofEventCounts(normalizedEventIds);
  const missingEventIds = normalizedEventIds.filter(
    (eventId) => !partialCachedCounts.has(eventId),
  );
  if (missingEventIds.length === 0) {
    setCachedSocialProofCounts(cacheKey, partialCachedCounts);
    return partialCachedCounts;
  }

  const sharedCachedCounts = await getSharedCacheJson<SerializedSocialProofCounts>(
    SOCIAL_PROOF_CACHE_NAMESPACE,
    cacheKey,
  );
  if (sharedCachedCounts) {
    const counts = deserializeCounts(sharedCachedCounts);
    setCachedSocialProofEventCounts(counts);
    setCachedSocialProofCounts(cacheKey, counts);
    return counts;
  }

  const missingCacheKey = buildSocialProofCacheKey(missingEventIds);
  const inFlightRequest = socialProofInFlight.get(missingCacheKey);
  if (inFlightRequest) {
    const resolvedCounts = cloneCountsMap(await inFlightRequest);
    const mergedCounts = new Map(partialCachedCounts);
    for (const [eventId, value] of resolvedCounts.entries()) {
      mergedCounts.set(eventId, value);
    }
    setCachedSocialProofCounts(cacheKey, mergedCounts);
    return mergedCounts;
  }

  const fetchPromise = (async () => {
  const counts = new Map<number, { going: number; interested: number; recommendations: number }>();

  let serviceClient;
  try {
    serviceClient = createServiceClient();
  } catch {
    // Service key not available (e.g., during build), return empty counts
    missingEventIds.forEach((id) => {
      counts.set(id, { going: 0, interested: 0, recommendations: 0 });
    });
    const mergedCounts = new Map(partialCachedCounts);
    for (const [eventId, value] of counts.entries()) {
      mergedCounts.set(eventId, value);
    }
    setCachedSocialProofEventCounts(counts);
    setCachedSocialProofCounts(cacheKey, mergedCounts);
    return mergedCounts;
  }

  const { data, error } = await (
    serviceClient.rpc as unknown as (
      name: string,
      params?: Record<string, unknown>
    ) => Promise<{ data: unknown; error: unknown }>
  )("get_social_proof_counts", {
    event_ids: missingEventIds,
  });

  if (error) {
    logger.error("Failed to fetch social proof counts", error);
    missingEventIds.forEach((id) => {
      counts.set(id, { going: 0, interested: 0, recommendations: 0 });
    });
    const mergedCounts = new Map(partialCachedCounts);
    for (const [eventId, value] of counts.entries()) {
      mergedCounts.set(eventId, value);
    }
    setCachedSocialProofEventCounts(counts);
    setCachedSocialProofCounts(cacheKey, mergedCounts);
    return mergedCounts;
  }

  type SocialProofRow = {
    event_id: number;
    going_count: number;
    interested_count: number;
    recommendation_count: number;
  };

  for (const row of (data || []) as SocialProofRow[]) {
    counts.set(row.event_id, {
      going: Number(row.going_count),
      interested: Number(row.interested_count),
      recommendations: Number(row.recommendation_count),
    });
  }

  missingEventIds.forEach((id) => {
    if (!counts.has(id)) {
      counts.set(id, { going: 0, interested: 0, recommendations: 0 });
    }
  });

  setCachedSocialProofEventCounts(counts);
  const mergedCounts = new Map(partialCachedCounts);
  for (const [eventId, value] of counts.entries()) {
    mergedCounts.set(eventId, value);
  }
  setCachedSocialProofCounts(cacheKey, mergedCounts);
  await setSharedCacheJson(
    SOCIAL_PROOF_CACHE_NAMESPACE,
    cacheKey,
    serializeCounts(mergedCounts),
    SOCIAL_PROOF_CACHE_TTL_MS,
    { maxEntries: SOCIAL_PROOF_CACHE_MAX_ENTRIES },
  );
  return mergedCounts;
  })();

  socialProofInFlight.set(missingCacheKey, fetchPromise);
  try {
    return cloneCountsMap(await fetchPromise);
  } finally {
    const currentRequest = socialProofInFlight.get(missingCacheKey);
    if (currentRequest === fetchPromise) {
      socialProofInFlight.delete(missingCacheKey);
    }
  }
}

/**
 * Enrich events with social proof counts (going, interested, recommendations).
 */
export async function enrichEventsWithSocialProof(
  events: EventWithLocation[]
): Promise<EventWithLocation[]> {
  const eventIds = events.map((e) => e.id);
  const counts = await fetchSocialProofCounts(eventIds);

  return events.map((event) => {
    const eventCounts = counts.get(event.id);
    return {
      ...event,
      going_count: eventCounts?.going || 0,
      interested_count: eventCounts?.interested || 0,
      recommendation_count: eventCounts?.recommendations || 0,
    };
  });
}
