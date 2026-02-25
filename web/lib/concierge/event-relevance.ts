import type { DayPart, FeedEvent } from "@/lib/forth-types";

const HIGH_SIGNAL_CATEGORIES = new Set([
  "music",
  "theater",
  "comedy",
  "nightlife",
  "food_drink",
  "film",
  "art",
]);

const LOW_SIGNAL_CATEGORIES = new Set([
  "community",
  "learning",
  "fitness",
  "volunteer",
  "religion",
]);

const HOSPITALITY_POSITIVE_KEYWORDS = [
  "rooftop",
  "cocktail",
  "dinner",
  "tasting",
  "live",
  "show",
  "jazz",
  "night",
  "happy hour",
  "brunch",
  "market",
  "festival",
];

const HOSPITALITY_NEGATIVE_KEYWORDS = [
  "clinic",
  "vaccine",
  "support group",
  "board meeting",
  "council",
  "worship",
  "prayer",
  "ordinance",
  "committee",
  "hearing",
  "volunteer",
  "certification",
];

const CATEGORY_REASON_LABELS: Record<string, string> = {
  music: "Live music",
  comedy: "Comedy night",
  theater: "Theater pick",
  nightlife: "Nightlife energy",
  food_drink: "Dining favorite",
  film: "Cinema pick",
  art: "Arts & culture",
};

const KEYWORD_REASON_LABELS: Array<{ keyword: string; label: string }> = [
  { keyword: "rooftop", label: "Rooftop vibe" },
  { keyword: "cocktail", label: "Cocktail spot" },
  { keyword: "happy hour", label: "Happy hour" },
  { keyword: "brunch", label: "Brunch-friendly" },
  { keyword: "jazz", label: "Live jazz" },
  { keyword: "festival", label: "Festival atmosphere" },
];

type RankedEvent = FeedEvent & { _score: number };

function parseStartHour(timeValue: string | null | undefined): number | null {
  if (!timeValue) return null;
  const parts = timeValue.split(":");
  if (parts.length < 2) return null;
  const hour = Number.parseInt(parts[0], 10);
  if (Number.isNaN(hour)) return null;
  return Math.min(23, Math.max(0, hour));
}

function dayPartTimeScore(dayPart: DayPart, hour: number | null): number {
  if (hour === null) return 0.4;

  if (dayPart === "morning") {
    if (hour >= 6 && hour < 11) return 2.4;
    if (hour >= 11 && hour < 14) return 0.8;
    if (hour >= 17) return -1.2;
    return -0.2;
  }

  if (dayPart === "afternoon") {
    if (hour >= 11 && hour < 17) return 2.2;
    if (hour >= 17 && hour < 20) return 0.6;
    if (hour >= 21 || hour < 7) return -1.1;
    return -0.1;
  }

  if (dayPart === "evening") {
    if (hour >= 17 && hour < 23) return 2.5;
    if (hour >= 14 && hour < 17) return 0.7;
    if (hour < 11) return -1.6;
    return -0.4;
  }

  if (hour >= 22 || hour < 3) return 2.6;
  if (hour >= 19 && hour < 22) return 0.9;
  if (hour >= 3 && hour < 9) return -1.4;
  return -0.2;
}

function dayPartTimeReason(dayPart: DayPart, hour: number | null): string | null {
  if (hour === null) return null;

  if (dayPart === "morning" && hour >= 6 && hour < 11) return "Great this morning";
  if (dayPart === "afternoon" && hour >= 11 && hour < 17) return "Ideal this afternoon";
  if (dayPart === "evening" && hour >= 17 && hour < 23) return "Perfect for tonight";
  if (dayPart === "late_night" && (hour >= 22 || hour < 3)) return "Open late";
  return null;
}

function categoryScore(dayPart: DayPart, categoryValue: string | null | undefined): number {
  const category = (categoryValue || "").toLowerCase();
  if (!category) return 0;

  let score = 0;
  if (HIGH_SIGNAL_CATEGORIES.has(category)) score += 1.5;
  if (LOW_SIGNAL_CATEGORIES.has(category)) score -= 2.2;

  if (dayPart === "morning") {
    if (category === "food_drink" || category === "art" || category === "film") score += 1.2;
    if (category === "nightlife") score -= 1.3;
  } else if (dayPart === "afternoon") {
    if (category === "food_drink" || category === "art" || category === "film") score += 0.9;
    if (category === "nightlife") score -= 0.8;
  } else if (dayPart === "evening") {
    if (category === "music" || category === "nightlife" || category === "food_drink" || category === "comedy" || category === "theater") score += 1.3;
  } else {
    if (category === "nightlife" || category === "music" || category === "food_drink") score += 1.5;
    if (category === "community" || category === "learning") score -= 0.8;
  }

  return score;
}

function keywordScore(event: FeedEvent): number {
  const combined = `${event.title || ""} ${event.description || ""}`.toLowerCase();
  let score = 0;

  for (const keyword of HOSPITALITY_POSITIVE_KEYWORDS) {
    if (combined.includes(keyword)) score += 0.45;
  }

  for (const keyword of HOSPITALITY_NEGATIVE_KEYWORDS) {
    if (combined.includes(keyword)) score -= 1.9;
  }

  return score;
}

function distanceScore(distanceKm: number | null | undefined): number {
  if (typeof distanceKm !== "number") return 0;
  if (distanceKm <= 1.2) return 1.8;
  if (distanceKm <= 2.5) return 1.1;
  if (distanceKm <= 5) return 0.3;
  if (distanceKm <= 8) return -0.8;
  return -1.8;
}

function distanceReason(distanceKm: number | null | undefined): string | null {
  if (typeof distanceKm !== "number") return null;
  if (distanceKm <= 1.2) return "Walkable from hotel";
  if (distanceKm <= 2.5) return "Short ride away";
  return null;
}

function keywordReason(event: FeedEvent): string | null {
  const combined = `${event.title || ""} ${event.description || ""}`.toLowerCase();
  for (const entry of KEYWORD_REASON_LABELS) {
    if (combined.includes(entry.keyword)) return entry.label;
  }
  return null;
}

function categoryReason(categoryValue: string | null | undefined): string | null {
  const category = (categoryValue || "").toLowerCase();
  return CATEGORY_REASON_LABELS[category] || null;
}

export function scoreEventForConcierge(event: FeedEvent, dayPart: DayPart): number {
  const startHour = parseStartHour(event.start_time);

  let score = 0;
  score += dayPartTimeScore(dayPart, startHour);
  score += categoryScore(dayPart, event.category);
  score += keywordScore(event);
  score += distanceScore(event.distance_km);

  if (event.image_url) score += 0.35;
  if (event.is_free) score += 0.1;

  return Math.round(score * 100) / 100;
}

export function getConciergeReasonChips(
  event: FeedEvent,
  dayPart: DayPart,
  options?: { maxChips?: number },
): string[] {
  const maxChips = options?.maxChips ?? 2;
  const chips: string[] = [];
  const startHour = parseStartHour(event.start_time);

  const timeReason = dayPartTimeReason(dayPart, startHour);
  if (timeReason) chips.push(timeReason);

  const proximityReason = distanceReason(event.distance_km);
  if (proximityReason) chips.push(proximityReason);

  const signalReason = keywordReason(event) || categoryReason(event.category);
  if (signalReason) chips.push(signalReason);

  if (event.is_free) chips.push("Free entry");

  return Array.from(new Set(chips)).slice(0, Math.max(1, maxChips));
}

function dedupeEventKey(event: FeedEvent): string {
  const id = event.id || "unknown";
  const date = event.start_date || "";
  const time = event.start_time || "";
  return `${id}:${date}:${time}`;
}

export function dedupeConciergeEvents(events: FeedEvent[]): FeedEvent[] {
  const seen = new Set<string>();
  const deduped: FeedEvent[] = [];

  for (const event of events) {
    const key = dedupeEventKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(event);
  }

  return deduped;
}

export function rankEventsForConcierge(
  events: FeedEvent[],
  dayPart: DayPart,
  options?: { minResults?: number; strictCutoff?: number },
): FeedEvent[] {
  const minResults = options?.minResults ?? 6;
  const strictCutoff = options?.strictCutoff ?? -0.4;

  const scored: RankedEvent[] = dedupeConciergeEvents(events)
    .map((event) => ({ ...event, _score: scoreEventForConcierge(event, dayPart) }))
    .sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      if ((b.distance_km ?? 99) !== (a.distance_km ?? 99)) return (a.distance_km ?? 99) - (b.distance_km ?? 99);
      return a.title.localeCompare(b.title);
    });

  const strict = scored.filter((event) => event._score >= strictCutoff);
  const chosen = strict.length >= minResults ? strict : scored;

  return chosen.map((event) => {
    const { _score, ...rest } = event;
    void _score;
    return rest;
  });
}
