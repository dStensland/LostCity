type EventClassificationShape = {
  content_kind?: string | null;
  title?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  is_all_day?: boolean | null;
  tags?: string[] | null;
  genres?: string[] | null;
  series?: {
    series_type?: string | null;
    title?: string | null;
  } | null;
  venue?: {
    venue_type?: string | null;
    name?: string | null;
  } | null;
};

const EXHIBIT_SIGNAL_TERMS = [
  "exhibit",
  "exhibition",
  "on view",
  "collection",
  "installation",
  "gallery",
  "permanent",
  "science on a sphere",
];

const EXHIBIT_SIGNAL_TAGS = new Set([
  "exhibit",
  "exhibition",
  "museum",
  "gallery",
  "installation",
  "on-view",
  "on_view",
]);

const EXHIBIT_VENUE_TYPES = new Set([
  "museum",
  "gallery",
  "science_center",
  "planetarium",
  "botanical_garden",
  "aquarium",
]);

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const SUPPRESSED_KINDS = new Set(["exhibit"]);

function parseDate(date: string | null | undefined): Date | null {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function durationDays(startDate: string | null | undefined, endDate: string | null | undefined): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) return 0;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY));
}

function hasExhibitSignals(event: EventClassificationShape): boolean {
  const corpus = [
    event.title,
    event.series?.title,
    ...(event.tags || []),
    ...(event.genres || []),
    event.venue?.name,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();

  if (EXHIBIT_SIGNAL_TERMS.some((term) => corpus.includes(term))) {
    return true;
  }

  const normalizedTagValues = [...(event.tags || []), ...(event.genres || [])]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase().trim());

  if (normalizedTagValues.some((value) => EXHIBIT_SIGNAL_TAGS.has(value))) {
    return true;
  }

  const venueType = event.venue?.venue_type?.toLowerCase().trim();
  return Boolean(venueType && EXHIBIT_VENUE_TYPES.has(venueType));
}

/**
 * Identify long-running exhibit content that should not appear in general "events" streams.
 * These are better represented in venue/program/exhibit contexts.
 */
export function isLongRunningExhibitLikeEvent(
  event: EventClassificationShape,
  options?: { minDurationDays?: number }
): boolean {
  const minDurationDays = options?.minDurationDays ?? 14;
  if (!event.is_all_day) return false;
  if (event.start_time) return false;

  const spanDays = durationDays(event.start_date, event.end_date);
  if (spanDays < minDurationDays) return false;

  const seriesType = event.series?.series_type;
  if (seriesType === "exhibition") return true;
  if (seriesType !== "recurring_show") return false;

  return hasExhibitSignals(event);
}

/**
 * General feed suppression rule:
 * - Explicit `content_kind=exhibit` always suppresses from event feeds.
 * - Fallback heuristic catches legacy data before/without migration backfill.
 */
export function isSuppressedFromGeneralEventFeed(
  event: EventClassificationShape,
  options?: { minDurationDays?: number }
): boolean {
  const normalizedContentKind = String(event.content_kind || "")
    .trim()
    .toLowerCase();
  if (SUPPRESSED_KINDS.has(normalizedContentKind)) {
    return true;
  }
  return isLongRunningExhibitLikeEvent(event, options);
}
