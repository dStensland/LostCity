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
import type { OnSalePayload } from "./types";

const DEFAULT_LIMIT = 30;

/**
 * On-sale loader. Returns music shows in the 2–6 month planning window
 * (today + 60d .. today + 180d), ordered by `created_at` DESC so the most
 * recently-announced shows surface first.
 *
 * Unlike by-show, there is no date grouping — this is a flat recency-sorted
 * list meant to power a "Just Announced" / on-sale browsing surface.
 */
export async function loadOnSale(
  portalSlug: string,
  limit: number = DEFAULT_LIMIT,
): Promise<OnSalePayload> {
  const empty: OnSalePayload = { shows: [] };

  const portal = await getPortalBySlug(portalSlug);
  if (!portal) return empty;

  const todayStr = getLocalDateString(new Date());
  const start = addDaysToDateString(todayStr, 60);
  const end = addDaysToDateString(todayStr, 180);

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
      tags, genres, created_at,
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

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    if (error) {
      logger.error("loadOnSale query error", { error: error.message });
    }
    return empty;
  }

  const rows = data as unknown as RawEventRow[];
  const shows = rows.map((r) => buildShowPayload(r));

  return { shows };
}
