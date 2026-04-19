/**
 * Tab and category count helpers for City Pulse.
 *
 * These operate on lightweight DB rows (category_id + series_id + genres/tags)
 * to compute badge counts and per-category event totals without loading full
 * event payloads.
 */

import { matchActivityType } from "@/lib/city-pulse/section-builders";
import type { FeedEventData } from "@/components/EventCard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal row shape returned by the lightweight count queries */
export type CountRow = {
  category_id: string | null;
  series_id: string | null;
  genres: string[] | null;
  tags: string[] | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Exclude recurring events that belong in Regular Hangs (The Scene).
 * These are counted separately so the Lineup tab badge doesn't include them.
 */
export function excludeSceneRows(rows: CountRow[]): CountRow[] {
  return rows.filter((row) => {
    if (!row.series_id) return true; // non-recurring → keep
    // Build minimal FeedEventData-shaped object for matchActivityType
    const pseudo = {
      id: 0, title: "", start_date: "", start_time: null, is_all_day: false,
      is_free: false, price_min: null, price_max: null, image_url: null,
      description: null, venue: { id: 0, name: "", slug: "", neighborhood: null },
      category: row.category_id,
      genres: row.genres,
      tags: row.tags,
    };
    // If it matches a scene activity type → exclude from Lineup counts
    return matchActivityType(pseudo as never) === null;
  });
}

/**
 * Deduplicate rows by series_id (keep first occurrence per series).
 * This ensures recurring events count as 1 in badge totals, matching
 * what the user actually sees after dedup in the section builders.
 */
export function dedupeCountRows(rows: CountRow[]): CountRow[] {
  const seriesSeen = new Set<string>();
  const result: CountRow[] = [];
  for (const row of rows) {
    if (row.series_id) {
      if (seriesSeen.has(row.series_id)) continue;
      seriesSeen.add(row.series_id);
    }
    result.push(row);
  }
  return result;
}

/**
 * Build per-category and per-genre/tag event counts from lightweight rows.
 * Applies scene exclusion + series deduplication before counting.
 * Returns counts keyed by category_id, `genre:<name>`, and `tag:<name>`.
 */
export function buildCategoryCounts(rows: CountRow[]): Record<string, number> {
  const deduped = dedupeCountRows(excludeSceneRows(rows));
  const counts: Record<string, number> = {};
  for (const row of deduped) {
    if (row.category_id) {
      counts[row.category_id] = (counts[row.category_id] || 0) + 1;
    }
    if (Array.isArray(row.genres)) {
      for (const g of row.genres) {
        counts[`genre:${g}`] = (counts[`genre:${g}`] || 0) + 1;
      }
    }
    if (Array.isArray(row.tags)) {
      for (const t of row.tags) {
        counts[`tag:${t}`] = (counts[`tag:${t}`] || 0) + 1;
      }
    }
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Friends going map builder (shared between tab-mode and full-load mode)
// ---------------------------------------------------------------------------

import type { FriendGoingInfo } from "@/lib/city-pulse/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fetch friend RSVPs for a set of event IDs and return a map of
 * event_id → FriendGoingInfo[]. Returns an empty map when no friend IDs
 * are provided or no RSVPs exist.
 */
export async function buildFriendsGoingMap(
  supabase: SupabaseClient,
  eventIds: number[],
  friendIds: string[],
): Promise<Record<number, FriendGoingInfo[]>> {
  const map: Record<number, FriendGoingInfo[]> = {};
  if (friendIds.length === 0 || eventIds.length === 0) return map;

  const { data: friendRsvps } = await supabase
    .from("plan_invitees")
    .select(`
      user_id,
      rsvp_status,
      plan:plans!inner (
        id, anchor_event_id, anchor_type
      )
    `)
    .in("user_id", friendIds)
    .in("rsvp_status", ["going", "interested"])
    .eq("plan.anchor_type", "event")
    .in("plan.anchor_event_id", eventIds);

  type FriendRsvpRow = {
    user_id: string;
    rsvp_status: string;
    plan: { id: string; anchor_event_id: number | null; anchor_type: string } | null;
  };
  const rawRsvps = (friendRsvps || []) as unknown as FriendRsvpRow[];
  const rsvps = rawRsvps
    .filter((r) => r.plan?.anchor_event_id != null)
    .map((r) => ({ event_id: r.plan!.anchor_event_id as number, user_id: r.user_id }));
  if (rsvps.length === 0) return map;

  const rsvpUserIds = [...new Set(rsvps.map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .in("id", rsvpUserIds);

  const profilesMap = (profiles || []).reduce(
    (acc, p) => {
      const profile = p as { id: string; username: string; display_name: string | null };
      acc[profile.id] = { username: profile.username, display_name: profile.display_name };
      return acc;
    },
    {} as Record<string, { username: string; display_name: string | null }>,
  );

  for (const rsvp of rsvps) {
    const profile = profilesMap[rsvp.user_id];
    if (!profile) continue;
    if (!map[rsvp.event_id]) {
      map[rsvp.event_id] = [];
    }
    map[rsvp.event_id].push({
      user_id: rsvp.user_id,
      username: profile.username,
      display_name: profile.display_name,
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Social proof application
// ---------------------------------------------------------------------------

/**
 * Merge social proof counts (going/interested) into event arrays.
 * Returns a new array — does not mutate the input.
 */
export function applySocialProof(
  events: FeedEventData[],
  socialCounts: Map<number, { going: number; interested: number }>,
): FeedEventData[] {
  return events.map((e) => {
    const counts = socialCounts.get(e.id);
    return counts
      ? { ...e, going_count: counts.going || 0, interested_count: counts.interested || 0 }
      : e;
  });
}
