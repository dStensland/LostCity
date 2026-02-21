/**
 * Social Proof Utilities
 *
 * Fetches and enriches entities with social proof data (RSVPs, follows, recommendations).
 * Extracted from search.ts to break circular dependency with unified-search.ts.
 */

import { createServiceClient } from "./supabase/service";
import { createLogger } from "./logger";
import type { EventWithLocation } from "./search";

const logger = createLogger("social-proof");

/**
 * Fetch social proof counts for a list of events using a single RPC call.
 */
export async function fetchSocialProofCounts(
  eventIds: number[]
): Promise<Map<number, { going: number; interested: number; recommendations: number }>> {
  if (eventIds.length === 0) {
    return new Map();
  }

  const counts = new Map<number, { going: number; interested: number; recommendations: number }>();

  let serviceClient;
  try {
    serviceClient = createServiceClient();
  } catch {
    // Service key not available (e.g., during build), return empty counts
    eventIds.forEach((id) => {
      counts.set(id, { going: 0, interested: 0, recommendations: 0 });
    });
    return counts;
  }

  const { data, error } = await (
    serviceClient.rpc as unknown as (
      name: string,
      params?: Record<string, unknown>
    ) => Promise<{ data: unknown; error: unknown }>
  )("get_social_proof_counts", {
    event_ids: eventIds,
  });

  if (error) {
    logger.error("Failed to fetch social proof counts", error);
    eventIds.forEach((id) => {
      counts.set(id, { going: 0, interested: 0, recommendations: 0 });
    });
    return counts;
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

  return counts;
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
