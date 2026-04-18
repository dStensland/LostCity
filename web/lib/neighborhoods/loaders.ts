import "server-only";

import { supabase } from "@/lib/supabase";
import type { Event } from "@/lib/supabase";
import { createServiceClient } from "@/lib/supabase/service";
import type { Spot } from "@/lib/spots-constants";
import { getLocalDateString } from "@/lib/formats";
import { getNeighborhoodByName } from "@/config/neighborhoods";
import { type NeighborhoodActivity } from "@/lib/neighborhood-colors";

const NOISE_CATEGORIES = new Set(["support_group", "unknown", "recreation"]);

/**
 * Places in a named neighborhood, sorted by upcoming event count then name.
 * Places are NOT portal-scoped (places.portal_id does not exist by design;
 * scoping is by city via the owning portal's config — places are shared).
 */
export async function getNeighborhoodSpots(
  neighborhoodName: string,
): Promise<(Spot & { event_count: number })[]> {
  const today = getLocalDateString();

  const { data: venues, error } = await supabase
    .from("places")
    .select("*")
    .eq("neighborhood", neighborhoodName)
    .eq("is_active", true)
    .order("name");

  if (error || !venues) return [];

  const venueIds = venues.map((v: Spot) => v.id);
  if (venueIds.length === 0) return venues.map((v: Spot) => ({ ...v, event_count: 0 }));

  const { data: eventCounts } = await supabase
    .from("events")
    .select("place_id")
    .in("place_id", venueIds)
    .gte("start_date", today)
    .or("is_sensitive.eq.false,is_sensitive.is.null");

  const countMap = new Map<number, number>();
  for (const ev of (eventCounts || []) as { place_id: number | null }[]) {
    if (ev.place_id) countMap.set(ev.place_id, (countMap.get(ev.place_id) || 0) + 1);
  }

  return (venues as Spot[])
    .map((v) => ({ ...v, event_count: countMap.get(v.id) || 0 }))
    .sort((a, b) => b.event_count - a.event_count || a.name.localeCompare(b.name));
}

/**
 * Upcoming events in a set of places, portal-scoped.
 * Events inherit portal_id via trigger from sources.owner_portal_id.
 * Pass portalId=null to skip portal filtering (dev/debug only).
 */
export async function getNeighborhoodEvents(
  placeIds: number[],
  portalId: string | null,
): Promise<Event[]> {
  const today = getLocalDateString();
  if (placeIds.length === 0) return [];

  let query = supabase
    .from("events")
    .select(`
      *,
      venue:places!inner(id, name, slug, address, neighborhood, city, state),
      series:series(id, slug, title, series_type, image_url)
    `)
    .in("place_id", placeIds)
    .eq("is_active", true)
    .is("canonical_event_id", null)
    .gte("start_date", today)
    .or("is_sensitive.eq.false,is_sensitive.is.null");
  if (portalId) {
    query = query.or(`portal_id.eq.${portalId},portal_id.is.null`);
  }
  const { data, error } = await query
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(20);

  if (error || !data) return [];
  return data as Event[];
}

/**
 * Counts of events today + upcoming in a set of places, portal-scoped.
 * Uses `count: exact, head: true` — no rows returned, just counts.
 */
export async function getNeighborhoodEventCounts(
  placeIds: number[],
  portalId: string | null,
): Promise<{ todayCount: number; upcomingCount: number }> {
  const today = getLocalDateString();
  if (placeIds.length === 0) return { todayCount: 0, upcomingCount: 0 };

  let upcomingQuery = supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .in("place_id", placeIds)
    .eq("is_active", true)
    .is("canonical_event_id", null)
    .gte("start_date", today)
    .or("is_sensitive.eq.false,is_sensitive.is.null");
  if (portalId) {
    upcomingQuery = upcomingQuery.or(
      `portal_id.eq.${portalId},portal_id.is.null`,
    );
  }
  const { count: upcomingCount } = await upcomingQuery;

  let todayQuery = supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .in("place_id", placeIds)
    .eq("is_active", true)
    .is("canonical_event_id", null)
    .eq("start_date", today)
    .or("is_sensitive.eq.false,is_sensitive.is.null");
  if (portalId) {
    todayQuery = todayQuery.or(
      `portal_id.eq.${portalId},portal_id.is.null`,
    );
  }
  const { count: todayCount } = await todayQuery;

  return { todayCount: todayCount ?? 0, upcomingCount: upcomingCount ?? 0 };
}

/**
 * Count of active places by neighborhood (for the index page tiering).
 * Not portal-scoped (places are shared by city).
 */
export async function getVenueCountsByNeighborhood(): Promise<
  Record<string, number>
> {
  const { data, error } = await supabase
    .from("places")
    .select("neighborhood")
    .eq("is_active", true)
    .not("neighborhood", "is", null);

  if (error || !data) return {};

  const counts: Record<string, number> = {};
  for (const row of data as { neighborhood: string | null }[]) {
    if (row.neighborhood) {
      counts[row.neighborhood] = (counts[row.neighborhood] || 0) + 1;
    }
  }
  return counts;
}

function buildSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function computeRawScore(row: {
  events_today: number;
  events_week: number;
  venue_count: number;
  editorial_mention_count: number;
  occasion_type_count: number;
}): number {
  return (
    row.events_today * 5 +
    row.events_week * 1 +
    row.venue_count * 0.5 +
    row.editorial_mention_count * 2 +
    row.occasion_type_count * 1
  );
}

/**
 * Full activity data for the index page map + card grid.
 * Uses `get_neighborhood_activity` RPC (portal-aware via p_portal_id) for the
 * base tier counts, then secondary queries for categories, hangs, and RSVP
 * social-proof going counts (all portal-scoped via filter chain).
 *
 * Table note: uses `places` (not `venues`) — table renamed March 2026, FK
 * constraint renamed `events_venue_id_fkey` → `events_place_id_fkey`
 * (migration 20260328300001). Alias stays `venue` for downstream type-guard
 * compat.
 */
export async function getNeighborhoodsActivity(
  portalId: string | null,
  portalCities: string[] = ["Atlanta"],
): Promise<NeighborhoodActivity[]> {
  try {
    const serviceClient = createServiceClient();
    const { data: rpcRows, error } = await serviceClient.rpc(
      "get_neighborhood_activity" as never,
      {
        p_portal_id: portalId,
        p_city_names: portalCities,
      } as never,
    );

    if (error || !rpcRows) return [];

    type RpcRow = {
      neighborhood: string;
      events_today: number;
      events_week: number;
      venue_count: number;
      editorial_mention_count: number;
      occasion_type_count: number;
    };

    const rows = rpcRows as RpcRow[];
    const rawScores = rows.map(computeRawScore);
    const maxRaw = Math.max(...rawScores, 0);

    // Secondary queries: categories, active hangs, RSVP going counts
    const todayStr = getLocalDateString();
    const weekEndDate = new Date(todayStr + "T00:00:00");
    weekEndDate.setDate(weekEndDate.getDate() + 7);
    const weekEndStr = getLocalDateString(weekEndDate);

    let eventQuery = serviceClient
      .from("events")
      .select("id, category_id, venue:places!events_place_id_fkey(neighborhood)")
      .eq("is_active", true)
      .is("canonical_event_id", null)
      .gte("start_date", todayStr)
      .lte("start_date", weekEndStr);
    if (portalId) {
      eventQuery = eventQuery.or(
        `portal_id.eq.${portalId},portal_id.is.null`,
      );
    }

    const [eventResult, hangResult] = await Promise.all([
      eventQuery,
      serviceClient
        .from("hangs")
        .select("venue:places(neighborhood)")
        .eq("status", "active")
        .gt("auto_expire_at", new Date().toISOString()),
    ]);

    const eventRows = eventResult.data;

    // Aggregate categories + build event→neighborhood map for RSVP lookup
    const catsByHood: Record<string, Record<string, number>> = {};
    const eventIdToHood: Record<number, string> = {};
    if (eventRows) {
      for (const row of eventRows as {
        id: number;
        category_id: string | null;
        venue: { neighborhood: string | null } | null;
      }[]) {
        const neighborhood = row.venue?.neighborhood;
        if (neighborhood) eventIdToHood[row.id] = neighborhood;
        const cat = row.category_id;
        if (!neighborhood || !cat) continue;
        if (!catsByHood[neighborhood]) catsByHood[neighborhood] = {};
        catsByHood[neighborhood][cat] = (catsByHood[neighborhood][cat] ?? 0) + 1;
      }
    }

    // Aggregate active hangs by neighborhood
    const hangsByHood: Record<string, number> = {};
    if (hangResult.data) {
      for (const row of hangResult.data as {
        venue: { neighborhood: string | null } | null;
      }[]) {
        const n = row.venue?.neighborhood;
        if (n) hangsByHood[n] = (hangsByHood[n] ?? 0) + 1;
      }
    }

    // Batch RSVP going counts for this week's events
    const goingByHood: Record<string, number> = {};
    const eventIds = Object.keys(eventIdToHood).map(Number);
    if (eventIds.length > 0) {
      try {
        const { data: rsvpData } = await serviceClient.rpc(
          "get_social_proof_counts" as never,
          { event_ids: eventIds } as never,
        );
        if (rsvpData) {
          for (const r of rsvpData as {
            event_id: number;
            going_count: number;
          }[]) {
            const hood = eventIdToHood[r.event_id];
            if (hood && r.going_count > 0) {
              goingByHood[hood] = (goingByHood[hood] ?? 0) + r.going_count;
            }
          }
        }
      } catch (err) {
        // RSVP counts are non-critical — log but don't fail the page.
        console.warn("[neighborhoods] RSVP social-proof query failed:", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    function topCats(n: string): string[] {
      const counts = catsByHood[n];
      if (!counts) return [];
      return Object.entries(counts)
        .filter(([cat]) => !NOISE_CATEGORIES.has(cat))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([c]) => c);
    }

    return rows.map((row, i) => {
      const config = getNeighborhoodByName(row.neighborhood);
      const rawScore = rawScores[i];
      return {
        name: row.neighborhood,
        slug: buildSlug(row.neighborhood),
        tier: config?.tier ?? 3,
        eventsTodayCount: Number(row.events_today),
        eventsWeekCount: Number(row.events_week),
        venueCount: Number(row.venue_count),
        editorialMentionCount: Number(row.editorial_mention_count),
        occasionTypes: Number(row.occasion_type_count),
        activityScore: maxRaw > 0 ? Math.round((rawScore / maxRaw) * 100) : 0,
        topCategories: topCats(row.neighborhood),
        goingCount: goingByHood[row.neighborhood] ?? 0,
        activeHangsCount: hangsByHood[row.neighborhood] ?? 0,
      };
    });
  } catch (err) {
    console.error("[neighborhoods] Failed to fetch activity data:", err);
    return [];
  }
}
