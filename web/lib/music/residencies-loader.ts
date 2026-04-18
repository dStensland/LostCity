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
import { classifyMusicVenue, capacityBand } from "./classification";
import type { MusicResidencyPayload, MusicVenuePayload } from "./types";

/**
 * Shape of the joined event row we fetch for the next upcoming occurrence
 * of a residency. Place columns mirror the subset used by other music
 * loaders so we can reuse `classifyMusicVenue` / `capacityBand`.
 */
export interface ResidencyNextEventRow {
  id: number;
  start_date: string;
  start_time: string | null;
  doors_time: string | null;
  place: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    image_url: string | null;
    hero_image_url: string | null;
    short_description: string | null;
    music_programming_style: MusicVenuePayload["music_programming_style"];
    music_venue_formats: string[] | null;
    capacity: number | null;
  };
}

/**
 * Pure mapping from a joined events+place row into a `MusicVenuePayload`.
 * Kept pure (no DB calls) so it can be unit-tested without touching
 * Supabase. Mirrors the venue shape produced by `buildShowPayload` so the
 * residency view is consistent with the rest of the music surface.
 */
export function mapNextEventToVenue(
  row: ResidencyNextEventRow,
): MusicVenuePayload {
  const p = row.place;
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    neighborhood: p.neighborhood,
    image_url: p.image_url,
    hero_image_url: p.hero_image_url,
    music_programming_style: p.music_programming_style,
    music_venue_formats: p.music_venue_formats ?? [],
    capacity: p.capacity,
    editorial_line: p.short_description,
    display_tier: classifyMusicVenue(p),
    capacity_band: capacityBand(p.capacity),
  };
}

interface ResidencySeriesRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  day_of_week: string | null;
  image_url: string | null;
}

/**
 * Loads all active music residencies for the given portal, each annotated
 * with the next upcoming portal-visible event. Residencies with no
 * upcoming visible event are skipped — an abandoned residency shouldn't
 * occupy space in the UI.
 */
export async function loadResidencies(
  portalSlug: string,
): Promise<{ residencies: MusicResidencyPayload[] }> {
  const empty = { residencies: [] as MusicResidencyPayload[] };

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

  const { data: seriesData, error: seriesError } = await supabase
    .from("series")
    .select("id, title, slug, description, day_of_week, image_url")
    .eq("series_type", "residency")
    .eq("category", "music")
    .eq("is_active", true);

  if (seriesError || !seriesData) {
    if (seriesError) {
      logger.error("loadResidencies series query error", {
        error: seriesError.message,
      });
    }
    return empty;
  }

  const seriesRows = seriesData as unknown as ResidencySeriesRow[];
  const today = getLocalDateString(new Date());

  const residencies: MusicResidencyPayload[] = [];

  for (const s of seriesRows) {
    let query = supabase
      .from("events")
      .select(`
        id, start_date, start_time, doors_time,
        place:places!inner(
          id, name, slug, neighborhood, image_url, hero_image_url,
          short_description, music_programming_style, music_venue_formats, capacity
        )
      `)
      .eq("series_id", s.id)
      .eq("is_active", true)
      .is("canonical_event_id", null)
      .gte("start_date", today)
      .order("start_date", { ascending: true })
      .limit(1);

    query = applyFeedGate(query);
    query = applyManifestFederatedScopeToQuery(query, manifest, {
      publicOnlyWhenNoPortal: true,
      sourceIds: sourceAccess.sourceIds,
      sourceColumn: "source_id",
    });
    query = excludeSensitiveEvents(query);

    const { data: eventData, error: eventError } = await query;

    if (eventError) {
      logger.error("loadResidencies next-event query error", {
        error: eventError.message,
        series_id: s.id,
      });
      return empty;
    }

    const eventRows = (eventData ?? []) as unknown as ResidencyNextEventRow[];
    if (eventRows.length === 0) {
      // No upcoming portal-visible event — skip this residency.
      continue;
    }

    const next = eventRows[0];
    residencies.push({
      id: s.id,
      title: s.title,
      slug: s.slug,
      description: s.description,
      day_of_week: s.day_of_week,
      image_url: s.image_url,
      venue: mapNextEventToVenue(next),
      next_event: {
        id: next.id,
        start_date: next.start_date,
        start_time: next.start_time,
        doors_time: next.doors_time,
      },
    });
  }

  residencies.sort((a, b) => {
    const aDate = a.next_event?.start_date ?? "";
    const bDate = b.next_event?.start_date ?? "";
    return aDate.localeCompare(bDate);
  });

  return { residencies };
}
