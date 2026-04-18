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
import { filterGhostVenues } from "./classification";
import { effectiveStart } from "./tonight-loader";
import type {
  MusicShowPayload,
  MusicVenuePayload,
  ByVenuePayload,
} from "./types";

export interface ByVenueOptions {
  /** YYYY-MM-DD. Defaults to today in local (ET) time. */
  date?: string;
  /** Venue slugs that should be hoisted into the `my_venues` bucket. */
  pinned_slugs?: string[];
  /** When false (default), the `additional` bucket is returned empty. */
  include_additional?: boolean;
}

export type VenueGroup = {
  venue: MusicVenuePayload;
  shows: MusicShowPayload[];
};

type PartitionedGroups = {
  my_venues: VenueGroup[];
  editorial: VenueGroup[];
  marquee: VenueGroup[];
  additional: VenueGroup[];
};

/**
 * Group shows by `venue.id` and sort each group's shows by effective start
 * time ascending (doors || start || "").
 */
export function groupShowsByVenue(shows: MusicShowPayload[]): VenueGroup[] {
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
    g.shows.sort((a, b) =>
      effectiveStart(a.doors_time, a.start_time).localeCompare(
        effectiveStart(b.doors_time, b.start_time),
      ),
    );
  }
  return groups;
}

/**
 * Pure partition helper. Splits venue groups into the four by-venue buckets
 * based on pin list + `venue.display_tier`.
 *
 * Rules:
 * - slug in `pinnedSlugs` → `my_venues` (regardless of tier)
 * - display_tier === "editorial" → `editorial`
 * - display_tier === "marquee"   → `marquee`
 * - everything else               → `additional` (empty unless `includeAdditional`)
 */
export function partitionGroupsByTier(
  groups: VenueGroup[],
  pinnedSlugs: string[],
  includeAdditional: boolean,
): PartitionedGroups {
  const pinned = new Set(pinnedSlugs);
  const out: PartitionedGroups = {
    my_venues: [],
    editorial: [],
    marquee: [],
    additional: [],
  };

  for (const group of groups) {
    if (pinned.has(group.venue.slug)) {
      out.my_venues.push(group);
      continue;
    }
    const tier = group.venue.display_tier;
    if (tier === "editorial") {
      out.editorial.push(group);
    } else if (tier === "marquee") {
      out.marquee.push(group);
    } else {
      if (includeAdditional) out.additional.push(group);
    }
  }

  return out;
}

/**
 * By-venue music loader. Returns today's (or `opts.date`'s) music shows
 * grouped by venue, partitioned into four tier buckets.
 *
 * v1 deliberately does NOT accept server-side genre/free/age filters
 * (see Revisions R23) — the client applies filtering over the full payload.
 */
export async function loadByVenue(
  portalSlug: string,
  opts: ByVenueOptions = {},
): Promise<ByVenuePayload> {
  const resolvedDate = opts.date ?? getLocalDateString(new Date());
  const pinnedSlugs = opts.pinned_slugs ?? [];
  const includeAdditional = opts.include_additional ?? false;

  const empty: ByVenuePayload = {
    date: resolvedDate,
    my_venues: [],
    editorial: [],
    marquee: [],
    additional: [],
  };

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
    .eq("start_date", resolvedDate)
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
      logger.error("loadByVenue query error", { error: error.message });
    }
    return empty;
  }

  const rows = data as unknown as RawEventRow[];
  const shows = rows.map((r) => buildShowPayload(r));
  const groups = groupShowsByVenue(shows);
  const partitioned = partitionGroupsByTier(
    groups,
    pinnedSlugs,
    includeAdditional,
  );

  const pinned = new Set(pinnedSlugs);
  return {
    date: resolvedDate,
    my_venues: filterGhostVenues(partitioned.my_venues, { pinned }),
    editorial: filterGhostVenues(partitioned.editorial, { pinned }),
    marquee: filterGhostVenues(partitioned.marquee, { pinned }),
    additional: filterGhostVenues(partitioned.additional, { pinned }),
  };
}
