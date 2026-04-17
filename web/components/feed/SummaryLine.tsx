/**
 * SummaryLine — the one-line briefing under the hero masthead.
 *
 * Two states:
 *
 *   1. Named-event mode (preferred): when a named, high-confidence event
 *      exists for today/tonight, we lead with it.
 *        → "Cardi B, 7:30pm · 284 more"
 *      The start time is gold-accented; the rest is --soft. The title itself
 *      gets a strong text-shadow to stay crisp on busy hero photos.
 *
 *   2. Count mode (fallback): when no named event clears the bar.
 *        → "285 events tonight · 63 live music"
 *
 * Both states share the same typographic treatment — a reader shouldn't be
 * able to tell "named" vs "fallback" by styling, only by wording.
 */

import Link from "next/link";
import { formatTime } from "@/lib/formats";
import type { NamedEvent } from "@/lib/city-pulse/types";

interface SummaryLineProps {
  tabCounts?: { today: number; this_week: number; coming_up: number } | null;
  categoryCounts?: { today: Record<string, number> } | null;
  weather?: { temperature_f: number; condition: string; icon?: string } | null;
  namedEvent?: NamedEvent | null;
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

// Strong text-shadow — reinforces the cream title against bright hero photos
// where the background gradient alone isn't enough at eye level.
const TITLE_SHADOW = "0 1px 10px rgba(0,0,0,0.85), 0 0 3px rgba(0,0,0,0.9)";
const BODY_SHADOW = "0 1px 6px rgba(0,0,0,0.7)";

// ---------------------------------------------------------------------------
// Named-event presentation — "Cardi B, 7:30pm · 284 more"
// ---------------------------------------------------------------------------

function NamedEventLine({
  event,
  totalToday,
}: {
  event: NamedEvent;
  totalToday: number;
}) {
  const time = formatTime(event.start_time ?? null);
  const displayTime = time && time !== "TBA" ? time : null;
  const moreCount = Math.max(0, totalToday - 1);

  return (
    <p
      className="text-sm mt-1 leading-snug"
      style={{ color: "var(--soft)", textShadow: BODY_SHADOW }}
    >
      <Link
        href={event.href}
        className="font-semibold hover:underline underline-offset-2"
        style={{ color: "var(--cream)", textShadow: TITLE_SHADOW }}
      >
        {event.title}
      </Link>
      {displayTime && (
        <>
          <span style={{ color: "rgba(245,245,243,0.4)" }}>, </span>
          <span
            className="font-semibold"
            style={{ color: "var(--gold)", textShadow: TITLE_SHADOW }}
          >
            {displayTime}
          </span>
        </>
      )}
      {moreCount > 0 && (
        <>
          <span className="mx-1.5" style={{ color: "rgba(245,245,243,0.3)" }}>·</span>
          <span>{moreCount} more</span>
        </>
      )}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Count fallback
// ---------------------------------------------------------------------------

function buildCountSummary(
  tabCounts: SummaryLineProps["tabCounts"],
  categoryCounts: SummaryLineProps["categoryCounts"],
): string | null {
  const parts: string[] = [];

  const total = tabCounts?.today ?? 0;
  if (total > 0) {
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        hour12: false,
      }).format(new Date()),
    );
    const timeLabel = hour >= 12 ? "tonight" : "today";
    parts.push(`${total} events ${timeLabel}`);
  }

  const counts = categoryCounts?.today ?? {};
  let topCategory: string | null = null;
  let topCount = 0;
  for (const [id, count] of Object.entries(counts)) {
    if (id.startsWith("tag:") || id.startsWith("genre:")) continue;
    if (count > topCount) {
      topCount = count;
      topCategory = id;
    }
  }
  if (topCategory && topCount > 3) {
    const label = CATEGORY_LABELS[topCategory] ?? topCategory.replace(/_/g, " ");
    parts.push(`${topCount} ${label}`);
  }

  if (parts.length === 0) return null;
  return parts.join(" \u00B7 ");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SummaryLine({ tabCounts, categoryCounts, namedEvent }: SummaryLineProps) {
  const totalToday = tabCounts?.today ?? 0;

  if (namedEvent && totalToday > 0) {
    return <NamedEventLine event={namedEvent} totalToday={totalToday} />;
  }

  const summary = buildCountSummary(tabCounts, categoryCounts);

  if (!summary) {
    return <p className="text-sm mt-1 h-5" aria-hidden />;
  }

  return (
    <p
      className="text-sm mt-1"
      style={{ color: "var(--soft)", textShadow: BODY_SHADOW }}
    >
      {summary}
    </p>
  );
}

export type { SummaryLineProps };
