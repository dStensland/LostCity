/**
 * Card tier assignment for City Pulse feed items.
 *
 * Determines whether an event renders as a hero card, featured card,
 * or standard card based on its intrinsic signals and social context.
 *
 * Tiers:
 *   hero     — Tentpole events, festivals, flagship importance. Full-width treatment.
 *   featured — Editorially notable, friends going, major events. Elevated card.
 *   standard — Default. All other events.
 */

export type CardTier = "hero" | "featured" | "standard";

export interface TierableEvent {
  is_tentpole?: boolean;
  is_featured?: boolean;
  festival_id?: string | null;
  image_url?: string | null;
  featured_blurb?: string | null;
  importance?: "flagship" | "major" | "standard" | null;
  venue_has_editorial?: boolean;
}

/**
 * Compute an event's intrinsic score from its own fields.
 * Does not include social signals (friends going) — those are contextual.
 *
 * Score thresholds (for reference):
 *   >= 30 → hero
 *   >= 15 → featured
 *   <  15 → standard
 */
export function computeIntrinsicScore(event: TierableEvent): number {
  let score = 0;
  if (event.is_tentpole) score += 40;
  if (event.importance === "flagship") score += 40;
  if (event.importance === "major") score += 20;
  if (event.is_featured || event.featured_blurb) score += 15;
  if (event.festival_id) score += 30;
  if (event.venue_has_editorial) score += 15;
  if (event.image_url) score += 10;
  return score;
}

/**
 * Determine the card tier for an event.
 *
 * @param event - Event fields relevant to tier assignment
 * @param friendsGoingCount - Number of friends RSVPed to this event (social signal)
 */
export function getCardTier(
  event: TierableEvent,
  friendsGoingCount = 0,
): CardTier {
  const intrinsic = computeIntrinsicScore(event);
  if (intrinsic >= 30 || event.is_tentpole || event.festival_id) return "hero";
  if (intrinsic >= 15 || friendsGoingCount > 0) return "featured";
  return "standard";
}
