/**
 * Pipeline stage 6: Response assembly.
 *
 * Takes built sections + counts + resolved header and assembles the final
 * CityPulseResponse object. Also applies feed-header moderation (suppress/
 * boost) and cross-section event deduplication.
 *
 * Pure data transformation — no DB access.
 */

import type { FeedEventData } from "@/components/EventCard";
import type {
  CityPulseResponse,
  CityPulseSection,
  PersonalizationLevel,
  ResolvedHeader,
  EventsPulse,
} from "@/lib/city-pulse/types";
import type { FeedSectionData } from "@/components/feed/FeedSection";
import type { PipelineContext } from "./resolve-portal";
import type { FeedCounts } from "./fetch-counts";
import {
  buildPrecomputedCategoryCounts,
  buildAllWindowCategoryCounts,
  countForWindow,
} from "./fetch-counts";

// ---------------------------------------------------------------------------
// Stage function
// ---------------------------------------------------------------------------

/**
 * Assemble the final CityPulseResponse from all pipeline outputs.
 *
 * Steps:
 *  1. Apply feed-header event moderation (suppress + boost lists)
 *  2. Cross-section event deduplication (same event can't appear twice)
 *  3. Build tab_counts + category_counts from pre-computed rows
 *  4. Construct the final response object
 */
export function assembleResponse(
  ctx: PipelineContext,
  sections: CityPulseSection[],
  curatedSections: FeedSectionData[],
  resolvedHeader: ResolvedHeader,
  eventsPulse: EventsPulse,
  counts: FeedCounts,
  personalizationLevel: PersonalizationLevel,
): CityPulseResponse {
  // Apply event moderation from feed header (suppress + boost)
  const suppressedIds = new Set(resolvedHeader.suppressed_event_ids);
  const boostedIds = new Set(resolvedHeader.boosted_event_ids);

  if (suppressedIds.size > 0 || boostedIds.size > 0) {
    for (const section of sections) {
      if (suppressedIds.size > 0) {
        section.items = section.items.filter(
          (item) => item.item_type !== "event" || !suppressedIds.has(item.event.id),
        );
      }

      if (boostedIds.size > 0) {
        const boosted: typeof section.items = [];
        const rest: typeof section.items = [];
        for (const item of section.items) {
          if (item.item_type === "event" && boostedIds.has(item.event.id)) {
            boosted.push(item);
          } else {
            rest.push(item);
          }
        }
        if (boosted.length > 0) {
          section.items = [...boosted, ...rest];
        }
      }
    }
  }

  // Cross-section event deduplication (an event appears in at most one section)
  const seenSectionEventIds = new Set<number>();

  const dedupedSections = sections.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.item_type !== "event") return true;
      if (seenSectionEventIds.has(item.event.id)) return false;
      seenSectionEventIds.add(item.event.id);
      return true;
    }),
  }));

  const dedupedCuratedSections = curatedSections.map((section) => ({
    ...section,
    events: section.events.filter((event: FeedEventData) => {
      if (seenSectionEventIds.has(event.id)) return false;
      seenSectionEventIds.add(event.id);
      return true;
    }),
  }));

  // Tab counts and category counts from pre-computed rows
  const { precomputedRows } = counts;

  const tab_counts = {
    today: countForWindow(precomputedRows, "today"),
    this_week: countForWindow(precomputedRows, "week"),
    coming_up: countForWindow(precomputedRows, "coming_up"),
  };

  const category_counts = {
    today: buildPrecomputedCategoryCounts(precomputedRows, "today"),
    this_week: buildPrecomputedCategoryCounts(precomputedRows, "week"),
    coming_up: buildPrecomputedCategoryCounts(precomputedRows, "coming_up"),
  };

  return {
    portal: {
      slug: ctx.canonicalSlug,
      name: ctx.portalData.name,
    },
    context: ctx.feedContext,
    header: resolvedHeader,
    sections: dedupedSections,
    curated_sections: dedupedCuratedSections,
    personalization: {
      level: personalizationLevel,
      applied: ctx.isAuthenticated && personalizationLevel !== "logged_in",
    },
    events_pulse: eventsPulse,
    tab_counts,
    category_counts,
  };
}

// ---------------------------------------------------------------------------
// Helper: compute allEventCategoryCounts (used by buildBrowseSection)
// ---------------------------------------------------------------------------

export { buildAllWindowCategoryCounts };
