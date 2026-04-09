import type { FeedEventData } from "@/components/EventCard";

const FESTIVAL_TAGS = new Set([
  "festival",
  "fest",
  "fair",
  "parade",
  "carnival",
  "pride",
]);

const FESTIVAL_TITLE_PATTERN =
  /\b(festival|fest|fair|parade|carnival|jubilee|pride)\b/i;

const EXPLICIT_FESTIVAL_TITLE_PATTERNS = [
  /dragon con/i,
  /momocon/i,
  /comic con/i,
  /anime weekend/i,
];

export function getEffectiveEventImageUrl(
  event: Pick<FeedEventData, "image_url" | "series" | "venue">,
): string | null {
  return event.image_url ?? event.series?.image_url ?? event.venue?.image_url ?? null;
}

export function isFestivalLikeEvent(
  event: Pick<FeedEventData, "festival_id" | "tags" | "title">,
): boolean {
  if (event.festival_id) return true;

  const tags = (event.tags ?? []).map((tag) => tag.toLowerCase());
  if (tags.some((tag) => FESTIVAL_TAGS.has(tag))) {
    return true;
  }

  if (FESTIVAL_TITLE_PATTERN.test(event.title)) {
    return true;
  }

  return EXPLICIT_FESTIVAL_TITLE_PATTERNS.some((pattern) => pattern.test(event.title));
}
