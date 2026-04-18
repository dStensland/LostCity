import { createClient } from "@/lib/supabase/server";
import { getPortalBySlug } from "@/lib/portal";
import { logger } from "@/lib/logger";
import { addDaysToDateString, getLocalDateString } from "@/lib/formats";
import { mapTagsToBuckets, type MusicGenreBucket } from "./genre-map";
import type { FestivalHorizonPayload } from "./types";

/**
 * Shape of the festivals row we query. Mirrors the real `festivals` table
 * columns (announced_start/announced_end/location/neighborhood/portal_id)
 * — NOT the start_date/end_date/is_active/place_id shape that appears in
 * other entity tables. Festivals have a plain-text `location` column, not
 * a `place_id` foreign key, so there's no join to `places` here.
 */
export interface FestivalHorizonRow {
  id: string;
  slug: string;
  name: string;
  announced_start: string;
  announced_end: string | null;
  image_url: string | null;
  tags: string[] | null;
  genres: string[] | null;
  description: string | null;
  neighborhood: string | null;
  location: string | null;
  announced_2026: boolean;
}

/**
 * Pure day-difference between two YYYY-MM-DD strings. Uses local noon to
 * avoid DST edge bugs around the spring-forward hour — rounding a 23-hour
 * or 25-hour window to whole days would otherwise produce off-by-one
 * errors on March/November transition days.
 */
export function daysBetween(fromYmd: string, toYmd: string): number {
  const [fy, fm, fd] = fromYmd.split("-").map(Number);
  const [ty, tm, td] = toYmd.split("-").map(Number);
  const a = new Date(fy, fm - 1, fd, 12);
  const b = new Date(ty, tm - 1, td, 12);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Pure mapping from a festivals row into the `FestivalHorizonPayload`
 * festival shape. Extracted so it can be unit-tested without touching
 * Supabase.
 */
export function mapFestivalRow(
  row: FestivalHorizonRow,
  todayStr: string,
): FestivalHorizonPayload["festivals"][number] {
  const tags = row.tags ?? [];
  const genres = row.genres ?? [];
  const buckets = mapTagsToBuckets([...tags, ...genres]);
  const genreBucket: MusicGenreBucket | null = buckets[0] ?? null;

  const description = row.description ?? "";
  const headlinerTeaser = description.slice(0, 80) || null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    start_date: row.announced_start,
    end_date: row.announced_end ?? row.announced_start,
    venue_name: row.location,
    neighborhood: row.neighborhood,
    days_away: daysBetween(todayStr, row.announced_start),
    headliner_teaser: headlinerTeaser,
    genre_bucket: genreBucket,
    image_url: row.image_url,
  };
}

/**
 * Loads announced 2026 music-adjacent festivals for the given portal in
 * the next 90 days. Festivals without a confirmed `announced_2026 = true`
 * flag are excluded — `pending_start`/`last_year_start` are planning data,
 * not public-facing dates.
 *
 * R3 schema note: the festivals table has no `is_active`, no `place_id`,
 * and uses `portal_id` (not `owner_portal_id`). The `location` column is
 * plain text — there is no `places` join.
 */
export async function loadFestivalsHorizon(
  portalSlug: string,
): Promise<FestivalHorizonPayload> {
  const empty: FestivalHorizonPayload = { festivals: [] };

  const portal = await getPortalBySlug(portalSlug);
  if (!portal) return empty;

  const supabase = await createClient();
  const todayStr = getLocalDateString(new Date());
  const endStr = addDaysToDateString(todayStr, 90);

  const { data, error } = await supabase
    .from("festivals")
    .select(
      "id, slug, name, announced_start, announced_end, image_url, tags, genres, description, neighborhood, location, announced_2026",
    )
    .eq("portal_id", portal.id)
    .eq("announced_2026", true)
    .gte("announced_start", todayStr)
    .lte("announced_start", endStr)
    .order("announced_start", { ascending: true });

  if (error) {
    logger.error("loadFestivalsHorizon query error", { error: error.message });
    return empty;
  }

  const rows = (data ?? []) as unknown as FestivalHorizonRow[];
  return { festivals: rows.map((row) => mapFestivalRow(row, todayStr)) };
}
