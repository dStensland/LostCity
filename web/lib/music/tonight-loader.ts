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
import { getLocalDateString } from "@/lib/formats";
import { buildShowPayload, type RawEventRow } from "./build-show-payload";
import type {
  MusicVenuePayload,
  MusicShowPayload,
  MusicDisplayTier,
  TonightPayload,
} from "./types";

/** Shows starting at or after 21:00 ET are bucketed as late-night. */
export const LATE_NIGHT_THRESHOLD = "21:00";

/**
 * The "effective" start time for a music show, used to decide whether the
 * show is tonight or late-night. Doors time wins over set time because
 * that's when the audience actually starts showing up. Falls back to
 * midnight when nothing is set (unknown / TBA) so the show still appears
 * in the early bucket rather than getting dropped.
 */
export function effectiveStart(
  doors: string | null,
  start: string | null,
): string {
  return doors || start || "00:00";
}

/** True when effectiveStart >= LATE_NIGHT_THRESHOLD (lexicographic on HH:mm). */
export function isLateNight(
  doors: string | null,
  start: string | null,
): boolean {
  return effectiveStart(doors, start) >= LATE_NIGHT_THRESHOLD;
}

const TIER_RANK: Record<MusicDisplayTier, number> = {
  editorial: 0,
  marquee: 1,
  additional: 2,
};

type VenueGroup = { venue: MusicVenuePayload; shows: MusicShowPayload[] };

function groupByVenue(shows: MusicShowPayload[]): VenueGroup[] {
  const byId = new Map<number, VenueGroup>();
  for (const show of shows) {
    const existing = byId.get(show.venue.id);
    if (existing) {
      existing.shows.push(show);
    } else {
      byId.set(show.venue.id, { venue: show.venue, shows: [show] });
    }
  }
  const groups = Array.from(byId.values());
  for (const g of groups) {
    g.shows.sort(
      (a, b) =>
        effectiveStart(a.doors_time, a.start_time).localeCompare(
          effectiveStart(b.doors_time, b.start_time),
        ),
    );
  }
  groups.sort(
    (a, b) => TIER_RANK[a.venue.display_tier] - TIER_RANK[b.venue.display_tier],
  );
  return groups;
}

export async function loadTonight(
  portalSlug: string,
  date?: string,
): Promise<TonightPayload> {
  const resolvedDate = date ?? getLocalDateString(new Date());

  const portal = await getPortalBySlug(portalSlug);
  if (!portal) {
    return { date: resolvedDate, tonight: [], late_night: [] };
  }

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
    .eq("start_date", resolvedDate)
    // Gate: only events at venues with an editorial OR marquee music
    // classification. Excludes events tagged "music" at non-music venues
    // (skating rinks, restaurants, breweries, rec centers).
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
      logger.error("loadTonight query error", { error: error.message });
    }
    return { date: resolvedDate, tonight: [], late_night: [] };
  }

  const rows = data as unknown as RawEventRow[];
  const shows = rows.map((r) => buildShowPayload(r));

  const tonightShows: MusicShowPayload[] = [];
  const lateNightShows: MusicShowPayload[] = [];
  for (const show of shows) {
    if (isLateNight(show.doors_time, show.start_time)) {
      lateNightShows.push(show);
    } else {
      tonightShows.push(show);
    }
  }

  return {
    date: resolvedDate,
    tonight: groupByVenue(tonightShows),
    late_night: groupByVenue(lateNightShows),
  };
}
