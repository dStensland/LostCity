import { addDays } from "date-fns";
import type { PortalFeedDateFilter } from "@/lib/portal-feed-plan";
import { getLocalDateString } from "@/lib/formats";

export type PortalAutoSectionEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_free: boolean;
  price_min: number | null;
  category: string | null;
  genres?: string[] | null;
  tags?: string[] | null;
  source_id?: number | null;
  going_count?: number;
  venue?: {
    id?: number | null;
    neighborhood?: string | null;
    venue_type?: string | null;
  } | null;
};

export type PortalAutoSectionFilter = {
  categories?: string[];
  subcategories?: string[];
  neighborhoods?: string[];
  tags?: string[];
  is_free?: boolean;
  price_max?: number;
  date_filter?: PortalFeedDateFilter;
  sort_by?: "date" | "popularity" | "trending" | "random";
  source_ids?: number[];
  venue_ids?: number[];
  exclude_ids?: number[];
  exclude_categories?: string[];
  nightlife_mode?: boolean;
};

const NIGHTLIFE_VENUE_TYPES = new Set([
  "bar",
  "nightclub",
  "rooftop",
  "karaoke",
  "brewery",
  "cocktail_bar",
]);

const ENTERTAINMENT_VENUE_TYPES = new Set([
  "music_venue",
  "theater",
  "amphitheater",
]);

const ENTERTAINMENT_CATEGORIES = new Set(["music", "comedy", "dance"]);

const NIGHTLIFE_ACTIVITY_LABELS: Record<string, string> = {
  karaoke: "Karaoke",
  trivia: "Trivia",
  bar_games: "Bar Games",
  poker: "Poker",
  bingo: "Bingo",
  dj: "DJ Night",
  drag: "Drag & Cabaret",
  latin_night: "Latin Night",
  line_dancing: "Line Dancing",
  party: "Party",
  pub_crawl: "Pub Crawl",
  specials: "Specials",
  live_music: "Live Music",
  comedy: "Freakin Clowns",
  dance: "Dance",
  other: "Nightlife",
};

function qualifiesForNightlife(event: PortalAutoSectionEvent): boolean {
  if (event.category === "nightlife") return true;

  const venueType = event.venue?.venue_type ?? null;
  const atNightlifeVenue = venueType
    ? NIGHTLIFE_VENUE_TYPES.has(venueType)
    : false;
  const atEntertainmentVenue = venueType
    ? ENTERTAINMENT_VENUE_TYPES.has(venueType)
    : false;
  const startsEvening = Boolean(event.start_time && event.start_time >= "17:00");
  const startsAfter7pm = Boolean(event.start_time && event.start_time >= "19:00");

  if (atNightlifeVenue && startsEvening) return true;

  if (event.category && ENTERTAINMENT_CATEGORIES.has(event.category)) {
    if (atNightlifeVenue && startsEvening) return true;
    if (atEntertainmentVenue && startsEvening) return true;
    return startsAfter7pm;
  }

  if (
    event.category &&
    new Set(["gaming", "food_drink", "social", "community"]).has(
      event.category,
    )
  ) {
    return (atNightlifeVenue || atEntertainmentVenue) && startsEvening;
  }

  return false;
}

function getNightlifeTier(event: PortalAutoSectionEvent): number {
  if (event.category === "nightlife") return 0;
  const venueType = event.venue?.venue_type ?? null;
  const atNightlifeVenue = venueType
    ? NIGHTLIFE_VENUE_TYPES.has(venueType)
    : false;
  const atEntertainmentVenue = venueType
    ? ENTERTAINMENT_VENUE_TYPES.has(venueType)
    : false;
  const isEntertainment = Boolean(
    event.category && ENTERTAINMENT_CATEGORIES.has(event.category),
  );
  if (isEntertainment && (atNightlifeVenue || atEntertainmentVenue)) return 1;
  if (atNightlifeVenue) return 2;
  if (isEntertainment) return 3;
  return 4;
}

export function classifyPortalNightlifeActivity(event: {
  title: string;
  category: string | null;
  genres?: string[] | null;
}): string {
  const genreActivityMap: Record<string, string> = {
    karaoke: "karaoke",
    trivia: "trivia",
    bar_games: "bar_games",
    poker: "poker",
    bingo: "bingo",
    dj: "dj",
    drag: "drag",
    burlesque: "drag",
    latin_night: "latin_night",
    line_dancing: "line_dancing",
    party: "party",
    pub_crawl: "pub_crawl",
    specials: "specials",
  };
  const titlePatterns: [RegExp, string][] = [
    [/karaoke/i, "karaoke"],
    [/trivia/i, "trivia"],
    [/bingo/i, "bingo"],
    [/poker/i, "poker"],
    [/two.?step|line.?danc|country.?danc/i, "line_dancing"],
    [/salsa|bachata|latin|reggaeton/i, "latin_night"],
    [/drag\b|cabaret|burlesque/i, "drag"],
    [/\bdj\b|dance.?party|club.?night/i, "dj"],
    [
      /bocce|skee.?ball|curling|darts|shuffleboard|bowling|arcade|bar.?game/i,
      "bar_games",
    ],
    [/pub.?crawl/i, "pub_crawl"],
  ];

  if (event.genres?.length) {
    for (const genre of event.genres) {
      if (genreActivityMap[genre]) return genreActivityMap[genre];
    }
  }

  for (const [pattern, key] of titlePatterns) {
    if (pattern.test(event.title)) {
      return key;
    }
  }

  if (event.category === "music") return "live_music";
  if (event.category === "comedy") return "comedy";
  if (event.category === "dance") return "dance";
  return "other";
}

export function buildPortalNightlifeCarouselData<T extends PortalAutoSectionEvent>(
  events: T[],
): {
  categories: Array<{ id: string; label: string; count: number }>;
  stampedEvents: Array<T & { activity_type: string }>;
} {
  const activityCounts = new Map<string, { count: number; label: string }>();

  for (const event of events) {
    const activityType = classifyPortalNightlifeActivity(event);
    const existing = activityCounts.get(activityType) || {
      count: 0,
      label: NIGHTLIFE_ACTIVITY_LABELS[activityType] || activityType,
    };
    existing.count++;
    activityCounts.set(activityType, existing);
  }

  const categories = Array.from(activityCounts.entries())
    .map(([id, { count, label }]) => ({ id, label, count }))
    .filter((category) => category.id !== "other" || activityCounts.size === 1)
    .sort((a, b) => b.count - a.count);

  return {
    categories,
    stampedEvents: events.map((event) => ({
      ...event,
      activity_type: classifyPortalNightlifeActivity(event),
    })),
  };
}

function distributeAcrossDateBuckets<T extends PortalAutoSectionEvent>(
  events: T[],
  limit: number,
  currentDate: Date,
): T[] {
  const todayStr = getLocalDateString(currentDate);
  const dayOfWeek = currentDate.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const endOfWeekDate = addDays(currentDate, daysUntilSunday);
  const endOfWeekStr = getLocalDateString(endOfWeekDate);

  const todayPool = events.filter((event) => event.start_date === todayStr);
  const weekPool = events.filter(
    (event) => event.start_date > todayStr && event.start_date <= endOfWeekStr,
  );
  const laterPool = events.filter((event) => event.start_date > endOfWeekStr);

  const todayBudget = Math.min(todayPool.length, Math.ceil(limit / 2));
  const remaining = limit - todayBudget;
  const weekBudget = Math.min(weekPool.length, Math.ceil(remaining / 2));
  const laterBudget = Math.min(laterPool.length, remaining - weekBudget);

  let result = [
    ...todayPool.slice(0, todayBudget),
    ...weekPool.slice(0, weekBudget),
    ...laterPool.slice(0, laterBudget),
  ];

  if (result.length < limit) {
    const used = new Set(result.map((event) => event.id));
    const backfill = events.filter((event) => !used.has(event.id));
    result = [...result, ...backfill.slice(0, limit - result.length)];
  }

  return result;
}

export function mergePortalMixedSectionEvents<T extends PortalAutoSectionEvent>(
  curatedEvents: T[],
  autoEvents: T[],
  limit: number,
): T[] {
  const curatedIds = new Set(curatedEvents.map((event) => event.id));
  const autoEventsFiltered = autoEvents.filter(
    (event) => !curatedIds.has(event.id),
  );
  return [...curatedEvents, ...autoEventsFiltered].slice(0, limit);
}

export function selectPortalAutoSectionEvents<T extends PortalAutoSectionEvent>(
  input: {
    pool: T[];
    filter: PortalAutoSectionFilter;
    limit: number;
    currentDate: Date;
    rsvpCounts: Record<number, number>;
    resolveDateRange: (
      filter: PortalFeedDateFilter,
    ) => { start: string; end: string };
  },
): {
  events: T[];
  fullFilteredPool: T[] | null;
} {
  let filtered = [...input.pool];
  const filter = input.filter;

  if (filter.date_filter) {
    const { start, end } = input.resolveDateRange(filter.date_filter);
    filtered = filtered.filter(
      (event) => event.start_date >= start && event.start_date <= end,
    );
  }

  if (filter.categories?.length) {
    filtered = filtered.filter(
      (event) => Boolean(event.category && filter.categories?.includes(event.category)),
    );
  }

  if (filter.nightlife_mode) {
    filtered = filtered.filter((event) => qualifiesForNightlife(event));
  }

  if (filter.source_ids?.length) {
    const sourceSet = new Set(filter.source_ids);
    filtered = filtered.filter(
      (event) =>
        event.source_id !== null &&
        event.source_id !== undefined &&
        sourceSet.has(event.source_id),
    );
  }

  if (filter.venue_ids?.length) {
    const venueSet = new Set(filter.venue_ids);
    filtered = filtered.filter(
      (event) =>
        event.venue?.id !== null &&
        event.venue?.id !== undefined &&
        venueSet.has(event.venue.id),
    );
  }

  if (filter.neighborhoods?.length) {
    const neighborhoods = new Set(
      filter.neighborhoods.map((value) => value.toLowerCase()),
    );
    filtered = filtered.filter(
      (event) =>
        Boolean(
          event.venue?.neighborhood &&
            neighborhoods.has(event.venue.neighborhood.toLowerCase()),
        ),
    );
  }

  if (filter.tags?.length) {
    const tagSet = new Set(filter.tags);
    filtered = filtered.filter(
      (event) =>
        Array.isArray(event.tags) &&
        event.tags.some((tag) => tagSet.has(tag)),
    );
  }

  if (filter.exclude_categories?.length) {
    filtered = filtered.filter(
      (event) =>
        !event.category || !filter.exclude_categories?.includes(event.category),
    );
  }

  if (filter.subcategories?.length) {
    const genreValues = filter.subcategories.map((subCategory) => {
      const parts = subCategory.split(".");
      return parts.length > 1 ? parts.slice(1).join(".") : subCategory;
    });
    const parentCategories = new Set(
      filter.subcategories.map((subCategory) => subCategory.split(".")[0]),
    );

    filtered = filtered.filter((event) => {
      if (event.genres?.some((genre) => genreValues.includes(genre))) {
        return true;
      }
      return Boolean(
        event.category &&
          parentCategories.has(event.category) &&
          !event.genres?.length,
      );
    });
  }

  if (filter.is_free) {
    filtered = filtered.filter((event) => event.is_free);
  }

  if (filter.price_max !== undefined) {
    filtered = filtered.filter(
      (event) =>
        event.is_free ||
        (event.price_min !== null && event.price_min <= filter.price_max!),
    );
  }

  if (filter.exclude_ids?.length) {
    const excludeSet = new Set(filter.exclude_ids);
    filtered = filtered.filter((event) => !excludeSet.has(event.id));
  }

  if (filter.nightlife_mode) {
    filtered.sort((left, right) => {
      const tierDiff = getNightlifeTier(left) - getNightlifeTier(right);
      if (tierDiff !== 0) return tierDiff;
      return (left.start_time || "23:59").localeCompare(
        right.start_time || "23:59",
      );
    });
  }

  const fullFilteredPool = filter.nightlife_mode ? [...filtered] : null;

  switch (filter.sort_by) {
    case "popularity":
      filtered = filtered
        .map((event) => ({
          ...event,
          going_count: input.rsvpCounts[event.id] || 0,
        }))
        .sort((left, right) => (right.going_count || 0) - (left.going_count || 0));
      break;
    case "trending":
      filtered.sort((left, right) => left.start_date.localeCompare(right.start_date));
      break;
    case "random":
      filtered = filtered.sort(() => Math.random() - 0.5);
      break;
    default:
      break;
  }

  if (input.limit >= 8 && filtered.length > input.limit) {
    return {
      events: distributeAcrossDateBuckets(filtered, input.limit, input.currentDate),
      fullFilteredPool,
    };
  }

  return {
    events: filtered.slice(0, input.limit),
    fullFilteredPool,
  };
}
