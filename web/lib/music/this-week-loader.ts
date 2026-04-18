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
import { buildShowPayload, type RawEventRow } from "./build-show-payload";
import { isoWeekRange } from "./date-windows";
import { scoreShow } from "./signal-score";
import type { MusicShowPayload, ThisWeekPayload } from "./types";

export { isoWeekRange };

/**
 * Curator-first cascade: pick up to 3 "This Week" music shows.
 * Signal priority: curator_pick > flagship/tentpole > major > festival > one-night title > drop.
 */
export async function loadThisWeek(
  portalSlug: string,
): Promise<ThisWeekPayload> {
  const portal = await getPortalBySlug(portalSlug);
  if (!portal) return { shows: [] };

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

  const { start, end } = isoWeekRange(new Date());

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
    .gte("start_date", start)
    .lte("start_date", end);

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
      logger.error("loadThisWeek query error", { error: error.message });
    }
    return { shows: [] };
  }

  const rows = data as unknown as RawEventRow[];

  const ranked = rows
    .map((r) => ({ row: r, s: scoreShow(r) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3);

  const shows: MusicShowPayload[] = ranked.map((x) => buildShowPayload(x.row));
  return { shows };
}
