/**
 * SummaryLine — one-line briefing for normal (non-flagship) days.
 *
 * Example output: "47 events tonight · 12 live music · Perfect patio weather"
 *
 * Renders null when there is nothing meaningful to say. No weather comment
 * is forced — a missing or ambiguous condition produces no weather part.
 */

interface SummaryLineProps {
  tabCounts?: { today: number; this_week: number; coming_up: number } | null;
  categoryCounts?: { today: Record<string, number> } | null;
  weather?: { temperature_f: number; condition: string; icon?: string } | null;
}

// ---------------------------------------------------------------------------
// Category labels
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  music: "live music",
  art: "art",
  arts: "art",
  comedy: "comedy",
  food_drink: "food & drink",
  food: "food & drink",
  nightlife: "nightlife",
  film: "film",
  theater: "theater",
  dance: "dance",
  sports: "sports",
  fitness: "fitness",
  community: "community",
  family: "family",
  kids: "kids",
  outdoors: "outdoors",
  education: "education",
  tech: "tech",
  business: "business",
};

// ---------------------------------------------------------------------------
// Weather context
// ---------------------------------------------------------------------------

function getWeatherPhrase(
  temperature_f: number,
  condition: string,
): string | null {
  const c = condition.toLowerCase();

  const isRain =
    c.includes("rain") || c.includes("drizzle") || c.includes("storm") || c.includes("thunder");
  const isClear = c.includes("clear") || c.includes("sunny");
  const isCloudy = c.includes("cloud") || c.includes("overcast");

  if (isRain) return "Indoor day";

  if (isClear) {
    if (temperature_f >= 65 && temperature_f <= 85) return "Perfect patio weather";
    if (temperature_f > 55 && temperature_f < 65) return "Beautiful evening ahead";
    if (temperature_f > 85 && temperature_f <= 95) return "Hot one \u2014 find some shade";
    if (temperature_f < 45) return "Bundle up tonight";
    return null;
  }

  if (isCloudy && temperature_f >= 55 && temperature_f <= 75) return "Nice out";

  return null;
}

// ---------------------------------------------------------------------------
// Core builder
// ---------------------------------------------------------------------------

function buildSummary(
  tabCounts: SummaryLineProps["tabCounts"],
  categoryCounts: SummaryLineProps["categoryCounts"],
  weather: SummaryLineProps["weather"],
): string | null {
  const parts: string[] = [];

  // Part 1: total event count
  const total = tabCounts?.today ?? 0;
  if (total > 0) {
    const now = new Date();
    const hour = now.getHours();
    const timeLabel = hour >= 12 ? "tonight" : "today";
    parts.push(`${total} events ${timeLabel}`);
  }

  // Part 2: top category
  const counts = categoryCounts?.today ?? {};
  let topCategory: string | null = null;
  let topCount = 0;
  for (const [id, count] of Object.entries(counts)) {
    if (count > topCount) {
      topCount = count;
      topCategory = id;
    }
  }
  if (topCategory && topCount > 3) {
    const label = CATEGORY_LABELS[topCategory] ?? topCategory.replace(/_/g, " ");
    parts.push(`${topCount} ${label}`);
  }

  // Part 3: weather context
  if (weather) {
    const phrase = getWeatherPhrase(weather.temperature_f, weather.condition);
    if (phrase) parts.push(phrase);
  }

  if (parts.length === 0) return null;
  return parts.join(" \u00B7 ");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SummaryLine({ tabCounts, categoryCounts, weather }: SummaryLineProps) {
  const summary = buildSummary(tabCounts, categoryCounts, weather);

  // Reserve the line height even when no data yet — prevents layout shift
  // when event counts arrive from the API
  if (!summary) {
    return <p className="text-sm mt-1 h-5" aria-hidden />;
  }

  return <p className="text-sm text-[var(--soft)] mt-1">{summary}</p>;
}

export type { SummaryLineProps };
