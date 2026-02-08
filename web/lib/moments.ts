import { getAllFestivals, type Festival } from "@/lib/festivals";
import { getCachedPortalBySlug } from "@/lib/portal";
import { getLocalDateString } from "@/lib/formats";
import {
  computeCountdown,
  type FestivalTier,
  type FestivalMoment,
  type TimeOfDay,
  type Season,
  type TimeContext,
  type MomentsResponse,
} from "@/lib/moments-utils";

// Re-export so existing imports from "@/lib/moments" keep working
export { computeCountdown };

// ============================================================================
// TIER CLASSIFICATION
// ============================================================================

/** Tier 1 festivals per portal — the tentpole events everyone knows */
const TIER1_BY_PORTAL: Record<string, Set<string>> = {
  atlanta: new Set([
    "dragon-con",
    "atlanta-pride",
    "shaky-knees",
    "music-midtown",
    "atlanta-jazz-festival",
    "atlanta-film-festival",
    "peachtree-road-race",
    "atlanta-dogwood-festival",
  ]),
};

export function classifyFestivalTier(
  festival: Festival,
  portalSlug: string
): FestivalTier {
  const tier1Set = TIER1_BY_PORTAL[portalSlug];
  if (tier1Set?.has(festival.slug)) return 1;

  const hasImage = !!festival.image_url;
  const hasDates = !!festival.announced_start;
  const isMultiDay = (festival.typical_duration_days ?? 0) > 1;

  if ((hasDates && hasImage) || isMultiDay) return 2;
  return 3;
}

// ============================================================================
// TIME CONTEXT
// ============================================================================

function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "latenight";
}

function getSeason(month: number): Season {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

export function getTimeContext(now: Date = new Date()): TimeContext {
  const hour = now.getHours();
  const day = now.getDay();
  const month = now.getMonth() + 1;

  const timeOfDay = getTimeOfDay(hour);
  const season = getSeason(month);
  const isWeekend = day === 0 || day === 5 || day === 6; // Fri, Sat, Sun

  let sectionLabel: string | null = null;
  let sectionCategories: string[] = [];

  if (timeOfDay === "morning" && isWeekend) {
    sectionLabel = "Brunch & Markets";
    sectionCategories = ["food_drink", "markets"];
  } else if (
    timeOfDay === "afternoon" &&
    (season === "spring" || season === "summer")
  ) {
    sectionLabel = "Patio SZN";
    sectionCategories = ["nightlife", "food_drink"];
  } else if (timeOfDay === "latenight" && isWeekend) {
    sectionLabel = "After Hours";
    sectionCategories = ["nightlife"];
  }
  // Evening + Fri/Sat is skipped — TonightsPicks handles this

  return { timeOfDay, season, isWeekend, sectionLabel, sectionCategories };
}

// ============================================================================
// MOMENTS AGGREGATION
// ============================================================================

export async function computeMoments(
  portalSlug: string
): Promise<MomentsResponse> {
  const portal = await getCachedPortalBySlug(portalSlug);
  const festivals = await getAllFestivals(portal?.id);
  const today = getLocalDateString();
  const timeContext = getTimeContext();

  const moments: FestivalMoment[] = festivals
    .map((festival) => {
      const tier = classifyFestivalTier(festival, portalSlug);
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

  return { takeover, imminent, upcoming, saveTheDate, timeContext };
}
