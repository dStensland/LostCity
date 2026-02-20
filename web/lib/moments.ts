import { getAllFestivals, type Festival } from "@/lib/festivals";
import { getCachedPortalBySlug } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { getLocalDateString } from "@/lib/formats";
import {
  computeCountdown,
  type FestivalTier,
  type FestivalMoment,
  type MomentsResponse,
} from "@/lib/moments-utils";

// Re-export so existing imports from "@/lib/moments" keep working
export { computeCountdown };

// ============================================================================
// TIER CLASSIFICATION (DB-driven via is_tentpole on events table)
// ============================================================================

/** Fetch festival IDs that have at least one is_tentpole event */
async function getTentpoleFestivalIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("festival_id")
    .eq("is_tentpole", true)
    .not("festival_id", "is", null);

  if (!data) return new Set();
  const ids = new Set<string>();
  for (const row of data) {
    const fid = (row as { festival_id: string | null }).festival_id;
    if (fid) ids.add(fid);
  }
  return ids;
}

export function classifyFestivalTier(
  festival: Festival,
  tentpoleIds: Set<string>
): FestivalTier {
  if (tentpoleIds.has(festival.id)) return 1;

  const hasImage = !!festival.image_url;
  const hasDates = !!festival.announced_start;
  const isMultiDay = (festival.typical_duration_days ?? 0) > 1;

  if ((hasDates && hasImage) || isMultiDay) return 2;
  return 3;
}

// ============================================================================
// MOMENTS AGGREGATION
// ============================================================================

export async function computeMoments(
  portalSlug: string
): Promise<MomentsResponse> {
  const portal = await getCachedPortalBySlug(portalSlug);
  const [festivals, tentpoleIds] = await Promise.all([
    getAllFestivals(portal?.id),
    getTentpoleFestivalIds(),
  ]);
  const today = getLocalDateString();

  const moments: FestivalMoment[] = festivals
    .map((festival) => {
      const tier = classifyFestivalTier(festival, tentpoleIds);
      const countdown = computeCountdown(festival, today);
      const isLive = countdown.urgency === "happening-now";
      return { festival, tier, countdown, isLive };
    })
    .filter((m) => m.countdown.urgency !== "tbd" && m.countdown.text !== "Past");

  // Takeover: Tier 1 that is live or within 3 days
  const takeover =
    moments.find(
      (m) =>
        m.tier === 1 &&
        (m.isLive ||
          (m.countdown.daysUntil !== null && m.countdown.daysUntil <= 3))
    ) ?? null;

  // Imminent: starting within 14 days (exclude takeover)
  const imminent = moments
    .filter(
      (m) =>
        m !== takeover &&
        m.countdown.daysUntil !== null &&
        m.countdown.daysUntil <= 14 &&
        m.countdown.daysUntil >= 0
    )
    .sort((a, b) => (a.countdown.daysUntil ?? 99) - (b.countdown.daysUntil ?? 99))
    .slice(0, 4);

  // Upcoming: starting within 90 days (exclude takeover and imminent)
  const imminentSet = new Set(imminent.map((m) => m.festival.id));
  const upcoming = moments
    .filter(
      (m) =>
        m !== takeover &&
        !imminentSet.has(m.festival.id) &&
        m.countdown.daysUntil !== null &&
        m.countdown.daysUntil <= 90 &&
        m.countdown.daysUntil > 0
    )
    .sort((a, b) => (a.countdown.daysUntil ?? 99) - (b.countdown.daysUntil ?? 99))
    .slice(0, 8);

  // Save the date: group by month for festivals beyond imminent
  const upcomingSet = new Set(upcoming.map((m) => m.festival.id));
  const saveTheDateFestivals = moments.filter(
    (m) =>
      m !== takeover &&
      !imminentSet.has(m.festival.id) &&
      !upcomingSet.has(m.festival.id) &&
      m.countdown.daysUntil !== null &&
      m.countdown.daysUntil > 0 &&
      m.festival.announced_start
  );

  const monthMap = new Map<string, FestivalMoment[]>();
  for (const m of saveTheDateFestivals) {
    const startDate = new Date(m.festival.announced_start + "T00:00:00");
    const monthKey = startDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    const arr = monthMap.get(monthKey) ?? [];
    arr.push(m);
    monthMap.set(monthKey, arr);
  }

  const saveTheDate = Array.from(monthMap.entries()).map(
    ([month, festivals]) => ({ month, festivals })
  );

  return { takeover, imminent, upcoming, saveTheDate };
}
