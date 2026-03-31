import type { PlaceContext } from "./types";

/**
 * Scores a place in a given category context.
 *
 * Four additive buckets:
 *   contextual fit  (0–40)
 *   activity boost  (0–30)
 *   quality floor   (0–20)
 *   recency bonus   (0–10)
 *
 * Maximum possible score: 100
 */
export function scorePlaceForCategory(ctx: PlaceContext): number {
  // --- Contextual fit (0–40) ---
  let contextual = 0;
  if (ctx.weatherMatch) contextual += 20;
  if (ctx.timeOfDayMatch) contextual += 10;
  if (ctx.seasonMatch) contextual += 10;
  // contextual is naturally bounded at 40

  // --- Activity boost (0–30) ---
  let activityRaw = 0;
  activityRaw += Math.min(ctx.eventsToday * 15, 30);
  activityRaw += Math.min(ctx.eventsThisWeek * 5, 20);
  if (ctx.hasActiveSpecial) activityRaw += 10;
  const activity = Math.min(activityRaw, 30);

  // --- Quality floor (0–20) ---
  let quality = 0;
  if (ctx.hasImage) quality += 8;
  if (ctx.hasDescription) quality += 5;
  if (ctx.isFeatured) quality += 5;
  if (ctx.occasions !== null && ctx.occasions.length >= 3) quality += 2;
  // quality is naturally bounded at 20

  // --- Recency bonus (0–10) ---
  let recencyRaw = 0;
  if (ctx.isNew && ctx.createdDaysAgo !== null && ctx.createdDaysAgo < 30) {
    recencyRaw += 10;
  } else if (ctx.createdDaysAgo !== null && ctx.createdDaysAgo < 90) {
    recencyRaw += 5;
  }
  if (ctx.hasNewEventsThisWeek) recencyRaw += 3;
  const recency = Math.min(recencyRaw, 10);

  return contextual + activity + quality + recency;
}

/**
 * Returns true if the place meets the minimum quality bar for display.
 * A place must have at least an image OR a description.
 */
export function passesQualityGate(ctx: PlaceContext): boolean {
  return ctx.hasImage || ctx.hasDescription;
}
