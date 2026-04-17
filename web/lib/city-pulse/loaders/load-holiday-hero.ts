/**
 * Server loader for HolidayHero.
 *
 * Resolves the active holiday for position 1 and pre-fetches its event tag
 * count so the client component renders without a client fetch on mount.
 * Calls the shared `getEventTagCount` helper directly — no internal HTTP.
 */
import { logger } from "@/lib/logger";
import {
  type HolidayConfig,
  getActiveHeroSlugs,
  getActiveHoliday,
} from "@/config/holidays";
import { getEventTagCount } from "@/lib/events/get-tag-count";
import type { FeedSectionContext } from "../feed-section-contract";

export interface HolidayHeroFeedData {
  holidaySlug: string;
  eventCount: number | null;
}

export async function loadHolidayHeroForFeed(
  ctx: FeedSectionContext,
): Promise<HolidayHeroFeedData | null> {
  const slugs = getActiveHeroSlugs();
  const targetSlug = slugs[0] ?? null;
  if (!targetSlug) return null;

  const holiday: HolidayConfig | null = getActiveHoliday(targetSlug);
  if (!holiday) return null;

  const tag = holiday.tag;
  if (!tag) return { holidaySlug: targetSlug, eventCount: null };

  try {
    const count = await getEventTagCount({ tag, portalSlug: ctx.portalSlug });
    return {
      holidaySlug: targetSlug,
      eventCount: count > 0 ? count : null,
    };
  } catch (err) {
    logger.error("load-holiday-hero failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { holidaySlug: targetSlug, eventCount: null };
  }
}
