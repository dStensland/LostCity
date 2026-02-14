import { createClient } from "@/lib/supabase/server";
import { getLocalDateString } from "@/lib/formats";
import type { Series } from "@/lib/series";

/**
 * Get related series based on type and genre overlap.
 * Returns up to 6 related series.
 */
export async function getRelatedSeries(
  seriesId: string,
  seriesType: string,
  genres: string[] | null,
  limit = 6
): Promise<Series[]> {
  const supabase = await createClient();

  // Build a query that prioritizes:
  // 1. Same type
  // 2. Overlapping genres
  // 3. Active series with upcoming events
  const query = supabase
    .from("series")
    .select("*")
    .eq("is_active", true)
    .neq("id", seriesId)
    .limit(limit);

  // Prefer same type
  if (seriesType) {
    query.eq("series_type", seriesType);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return [];
  }

  let results = data as Series[];

  // If we have genres, sort by genre overlap
  if (genres && genres.length > 0) {
    results = results
      .map((series) => {
        const overlap = series.genres
          ? series.genres.filter((g) => genres.includes(g)).length
          : 0;
        return { series, overlap };
      })
      .sort((a, b) => b.overlap - a.overlap)
      .map((item) => item.series);
  }

  // Get event counts for each series to prioritize active ones
  const today = getLocalDateString();
  const seriesIds = results.map((s) => s.id);

  const { data: countData } = await supabase
    .from("events")
    .select("series_id")
    .in("series_id", seriesIds)
    .gte("start_date", today)
    .or("is_sensitive.eq.false,is_sensitive.is.null");

  // Count events per series
  const counts: Record<string, number> = {};
  if (countData) {
    for (const event of countData) {
      const sid = (event as { series_id: string | null }).series_id;
      if (sid) {
        counts[sid] = (counts[sid] || 0) + 1;
      }
    }
  }

  // Sort by event count (series with more upcoming events first)
  results.sort((a, b) => {
    const aCount = counts[a.id] || 0;
    const bCount = counts[b.id] || 0;
    return bCount - aCount;
  });

  return results.slice(0, limit);
}
