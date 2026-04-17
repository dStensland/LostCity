/**
 * Server loader for HolidayHero.
 *
 * Resolves the active holiday for position 1 and pre-fetches its event tag
 * count so the client component renders without a client fetch on mount.
 */
import { logger } from "@/lib/logger";
import {
  type HolidayConfig,
  getActiveHeroSlugs,
  getActiveHoliday,
} from "@/config/holidays";
import type { FeedSectionContext } from "../feed-section-contract";

export interface HolidayHeroFeedData {
  holidaySlug: string;
  eventCount: number | null;
}

export async function loadHolidayHeroForFeed(
  _ctx: FeedSectionContext,
): Promise<HolidayHeroFeedData | null> {
  const slugs = getActiveHeroSlugs();
  const targetSlug = slugs[0] ?? null;
  if (!targetSlug) return null;

  const holiday: HolidayConfig | null = getActiveHoliday(targetSlug);
  if (!holiday) return null;

  const tag = holiday.tag;
  if (!tag) return { holidaySlug: targetSlug, eventCount: null };

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort("load-holiday-hero-timeout"),
    6000,
  );

  try {
    const res = await fetch(
      `${baseUrl}/api/events/tag-count?tag=${encodeURIComponent(tag)}&portal=${encodeURIComponent(_ctx.portalSlug)}`,
      { signal: controller.signal, next: { revalidate: 300 } },
    );
    if (!res.ok) return { holidaySlug: targetSlug, eventCount: null };
    const data = (await res.json()) as { count?: number };
    const count =
      typeof data.count === "number" && data.count > 0 ? data.count : null;
    return { holidaySlug: targetSlug, eventCount: count };
  } catch (err) {
    logger.error("load-holiday-hero failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { holidaySlug: targetSlug, eventCount: null };
  } finally {
    clearTimeout(timeout);
  }
}
