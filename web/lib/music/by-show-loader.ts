import { createClient } from "@/lib/supabase/server";
import { getPortalBySlug } from "@/lib/portal";
import { buildPortalManifest } from "@/lib/portal-manifest";
import { getPortalSourceAccess } from "@/lib/federation";
import {
  applyManifestFederatedScopeToQuery,
  excludeSensitiveEvents,
} from "@/lib/portal-scope";
import { applyFeedGate } from "@/lib/feed-gate";
import { logger } from "@/lib/logger";
import { getLocalDateString, addDaysToDateString } from "@/lib/formats";
import { buildShowPayload, type RawEventRow } from "./build-show-payload";
import { effectiveStart } from "./tonight-loader";
import type { MusicShowPayload, ByShowPayload } from "./types";

export interface ByShowOptions {
  /** YYYY-MM-DD, defaults to today in portal local (ET) time. */
  date?: string;
  /** Number of days to include in the window. Default 7, capped at 30. */
  days?: number;
}

const DEFAULT_DAYS = 7;
const MAX_DAYS = 30;

/**
 * Format a YYYY-MM-DD iso date as a human-readable day label for the
 * by-show grouped listing.
 *
 * - If the iso equals `today` → "TONIGHT"
 * - If the iso equals `today + 1` → "TOMORROW"
 * - Otherwise → uppercase `"WEEKDAY, MON D"` (e.g. "SATURDAY, APR 25")
 *
 * The formatter pins the parsed date at local noon so the day-of-week
 * never flips due to UTC offset math.
 */
export function dayLabel(iso: string, today: string): string {
  if (iso === today) return "TONIGHT";
  if (iso === addDaysToDateString(today, 1)) return "TOMORROW";
  const d = new Date(`${iso}T12:00:00`);
  return d
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    })
    .toUpperCase();
}

/**
 * Group music shows by `start_date`. Returns groups sorted by date ascending,
 * with shows within each group sorted by effective start time (doors || start).
 */
export function groupShowsByDate(
  shows: MusicShowPayload[],
): { date: string; shows: MusicShowPayload[] }[] {
  const byDate = new Map<string, MusicShowPayload[]>();
  for (const show of shows) {
    const bucket = byDate.get(show.start_date);
    if (bucket) {
      bucket.push(show);
    } else {
      byDate.set(show.start_date, [show]);
    }
  }
  const groups = Array.from(byDate.entries()).map(([date, list]) => {
    list.sort((a, b) =>
      effectiveStart(a.doors_time, a.start_time).localeCompare(
        effectiveStart(b.doors_time, b.start_time),
      ),
    );
    return { date, shows: list };
  });
  groups.sort((a, b) => a.date.localeCompare(b.date));
  return groups;
}

/**
 * By-show chronological music loader. Returns a contiguous date window of
 * music shows grouped by calendar day.
 *
 * v1 deliberately does NOT accept server-side filter options (see Revisions
 * R23) — genre/free/age/late-night filtering happens client-side over the
 * full payload.
 */
export async function loadByShow(
  portalSlug: string,
  opts: ByShowOptions = {},
): Promise<ByShowPayload> {
  const resolvedDate = opts.date ?? getLocalDateString(new Date());
  const requestedDays = opts.days ?? DEFAULT_DAYS;
  const days = Math.min(Math.max(requestedDays, 1), MAX_DAYS);
  const endDate = addDaysToDateString(resolvedDate, days - 1);

  const empty: ByShowPayload = { groups: [] };

  const portal = await getPortalBySlug(portalSlug);
  if (!portal) return empty;

  const sourceAccess = await getPortalSourceAccess(portal.id);
  const supabase = await createClient();
  const manifest = buildPortalManifest({
    portalId: portal.id,
    slug: portal.slug,
    portalType: portal.portal_type,
    parentPortalId: portal.parent_portal_id,
    settings: portal.settings,
    filters: portal.filters as { city?: string; cities?: string[] } | null,
    sourceIds: sourceAccess.sourceIds,
  });

  let query = supabase
    .from("events")
    .select(`
      id, title, start_date, start_time, doors_time, image_url,
      is_free, is_curator_pick, is_tentpole, importance, festival_id,
      ticket_status, ticket_url, age_policy, featured_blurb,
      tags, genres,
      place:places!inner(
        id, name, slug, neighborhood, image_url, hero_image_url, short_description,
        music_programming_style, music_venue_formats, capacity
      ),
      event_artists(artist_id, name, is_headliner, billing_order,
        artist:artists(slug))
    `)
    .eq("category_id", "music")
    .eq("is_active", true)
    .is("canonical_event_id", null)
    .gte("start_date", resolvedDate)
    .lte("start_date", endDate)
    // Gate: only events at venues with an editorial OR marquee music
    // classification. Excludes events tagged "music" at non-music venues.
    .not("places.music_programming_style", "is", null);

  query = applyFeedGate(query);
  query = applyManifestFederatedScopeToQuery(query, manifest, {
    publicOnlyWhenNoPortal: true,
    sourceIds: sourceAccess.sourceIds,
    sourceColumn: "source_id",
  });
  query = excludeSensitiveEvents(query);

  const { data, error } = await query;
  if (error || !data) {
    if (error) {
      logger.error("loadByShow query error", { error: error.message });
    }
    return empty;
  }

  const rows = data as unknown as RawEventRow[];
  const shows = rows.map((r) => buildShowPayload(r));
  const dateGroups = groupShowsByDate(shows);

  return {
    groups: dateGroups.map((g) => ({
      day_label: dayLabel(g.date, resolvedDate),
      date: g.date,
      shows: g.shows,
    })),
  };
}
