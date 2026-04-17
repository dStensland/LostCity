import { createClient } from "@/lib/supabase/server";
import { getPortalBySlug } from "@/lib/portal";
import { buildPortalManifest } from "@/lib/portal-manifest";
import { getPortalSourceAccess } from "@/lib/federation";
import { applyManifestFederatedScopeToQuery } from "@/lib/portal-scope";
import { logger } from "@/lib/logger";
import { buildShowPayload, type RawEventRow } from "./build-show-payload";
import type { MusicShowPayload, ThisWeekPayload } from "./types";

/**
 * ISO week (Mon–Sun) containing `today`. Returns inclusive YYYY-MM-DD bounds.
 */
export function isoWeekRange(today: Date): { start: string; end: string } {
  const day = (today.getDay() + 6) % 7; // 0=Mon, 6=Sun
  const start = new Date(today);
  start.setDate(today.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

const ONE_NIGHT_PATTERN =
  /\b(release party|farewell|finale|residency finale|one night|feat\.)\b/i;

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

  query = applyManifestFederatedScopeToQuery(query, manifest, {
    publicOnlyWhenNoPortal: true,
    sourceIds: sourceAccess.sourceIds,
    sourceColumn: "source_id",
  });

  const { data, error } = await query;
  if (error || !data) {
    if (error) {
      logger.error("loadThisWeek query error", { error: error.message });
    }
    return { shows: [] };
  }

  const rows = data as unknown as RawEventRow[];

  const score = (e: RawEventRow): number => {
    if (e.is_curator_pick) return 100;
    if (e.importance === "flagship" || e.is_tentpole) return 80;
    if (e.importance === "major") return 60;
    if (e.festival_id) return 50;
    if (ONE_NIGHT_PATTERN.test(e.title)) return 30;
    return 0;
  };

  const ranked = rows
    .map((r) => ({ row: r, s: score(r) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3);

  const shows: MusicShowPayload[] = ranked.map((x) => buildShowPayload(x.row));
  return { shows };
}
