/**
 * Curated portal sections: date-range helpers and section resolution.
 *
 * Resolves raw `portal_sections` DB rows (with optional pinned items and
 * auto-filters) into the `FeedSectionData` shape consumed by the frontend.
 */

import {
  addDays,
  startOfDay,
  isFriday,
  isSaturday,
  isSunday,
  nextFriday,
  nextSunday,
} from "date-fns";
import { getLocalDateString } from "@/lib/formats";
import type { FeedSectionData } from "@/components/feed/FeedSection";
import type { FeedEventData } from "@/components/EventCard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RawPortalSection = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  section_type: "auto" | "curated" | "mixed";
  block_type: string;
  layout: string;
  items_per_row?: number;
  max_items?: number;
  style?: Record<string, unknown> | null;
  block_content?: Record<string, unknown> | null;
  auto_filter?: Record<string, unknown> | null;
  portal_section_items?: Array<{
    id: string;
    entity_type: string;
    entity_id: number;
    display_order: number;
  }>;
};

// ---------------------------------------------------------------------------
// Date range helper
// ---------------------------------------------------------------------------

/**
 * Convert a named date-filter string into a concrete start/end date pair.
 * Used by auto-filter sections so the DB query can be constructed client-free.
 */
export function getDateRange(filter: string): { start: string; end: string } {
  const now = new Date();
  const todayDate = startOfDay(now);
  switch (filter) {
    case "today":
      return { start: getLocalDateString(todayDate), end: getLocalDateString(todayDate) };
    case "tomorrow": {
      const tmrw = addDays(todayDate, 1);
      return { start: getLocalDateString(tmrw), end: getLocalDateString(tmrw) };
    }
    case "this_weekend": {
      let friday: Date;
      let sunday: Date;
      if (isFriday(now) || isSaturday(now) || isSunday(now)) {
        friday = isFriday(now) ? todayDate : addDays(todayDate, -(now.getDay() - 5));
        sunday = isSunday(now) ? todayDate : addDays(todayDate, 7 - now.getDay());
      } else {
        friday = nextFriday(todayDate);
        sunday = nextSunday(todayDate);
      }
      return { start: getLocalDateString(friday), end: getLocalDateString(sunday) };
    }
    case "next_7_days":
      return { start: getLocalDateString(todayDate), end: getLocalDateString(addDays(todayDate, 7)) };
    case "next_30_days":
      return { start: getLocalDateString(todayDate), end: getLocalDateString(addDays(todayDate, 30)) };
    default:
      return { start: getLocalDateString(todayDate), end: getLocalDateString(addDays(todayDate, 14)) };
  }
}

// ---------------------------------------------------------------------------
// Curated section resolver
// ---------------------------------------------------------------------------

/**
 * Resolves raw portal_sections rows into FeedSectionData shape
 * by matching events from the event pool.
 */
export function resolveCuratedSections(
  rawSections: RawPortalSection[],
  eventPool: FeedEventData[],
): FeedSectionData[] {
  // Build lookup map by event ID
  const eventMap = new Map<number, FeedEventData>();
  for (const e of eventPool) {
    eventMap.set(e.id, e);
  }

  return rawSections.map((section) => {
    const limit = section.max_items || 12;

    // Non-event block types just need empty events
    if (
      ["category_grid", "announcement", "external_link", "countdown"].includes(
        section.block_type,
      )
    ) {
      return {
        id: section.id,
        title: section.title,
        slug: section.slug,
        description: section.description,
        section_type: section.section_type,
        block_type: section.block_type,
        layout: section.layout,
        items_per_row: section.items_per_row,
        style: section.style,
        block_content: section.block_content,
        auto_filter: section.auto_filter as FeedSectionData["auto_filter"],
        events: [],
      };
    }

    let events: FeedEventData[] = [];

    if (section.section_type === "curated") {
      // Resolve pinned items
      const items = (section.portal_section_items || [])
        .filter((item) => item.entity_type === "event")
        .sort((a, b) => a.display_order - b.display_order);
      events = items
        .map((item) => eventMap.get(item.entity_id))
        .filter((e): e is FeedEventData => e !== undefined)
        .slice(0, limit);
    } else if (
      (section.section_type === "auto" || section.section_type === "mixed") &&
      section.auto_filter
    ) {
      const filter = section.auto_filter as Record<string, unknown>;
      let filtered = [...eventPool];

      // Date filter
      if (filter.date_filter && typeof filter.date_filter === "string") {
        const { start, end } = getDateRange(filter.date_filter);
        filtered = filtered.filter(
          (e) => e.start_date >= start && e.start_date <= end,
        );
      }

      // Category filter
      if (Array.isArray(filter.categories) && filter.categories.length) {
        filtered = filtered.filter(
          (e) => e.category && (filter.categories as string[]).includes(e.category),
        );
      }

      // Nightlife mode
      if (filter.nightlife_mode) {
        const nightlifeVenueTypes = new Set([
          "bar", "nightclub", "rooftop", "karaoke",
          "brewery", "cocktail_bar",
        ]);
        const entertainmentVenueTypes = new Set([
          "music_venue", "theater", "amphitheater",
        ]);
        const entertainmentCategories = new Set(["music", "comedy", "dance"]);
        filtered = filtered.filter((e) => {
          if (e.category === "games" || e.category === "dance") return true;
          const vType = (e as unknown as Record<string, unknown>).venue &&
            typeof (e as unknown as Record<string, unknown>).venue === "object"
            ? ((e as unknown as Record<string, unknown>).venue as Record<string, unknown>)?.venue_type as string | undefined
            : undefined;
          const atNightlifeVenue = vType && nightlifeVenueTypes.has(vType);
          const atEntertainmentVenue = vType && entertainmentVenueTypes.has(vType);
          const startsEvening = e.start_time && e.start_time >= "17:00";
          if (atNightlifeVenue && startsEvening) return true;
          if (e.category && entertainmentCategories.has(e.category)) {
            if ((atNightlifeVenue || atEntertainmentVenue) && startsEvening) return true;
            return e.start_time ? e.start_time >= "19:00" : false;
          }
          return false;
        });
      }

      // Free filter
      if (filter.is_free) {
        filtered = filtered.filter((e) => e.is_free);
      }

      // Tag filter (tags exist on raw data but not in FeedEventData type)
      if (Array.isArray(filter.tags) && filter.tags.length) {
        const tagSet = new Set(filter.tags as string[]);
        filtered = filtered.filter((e) => {
          const tags = (e as unknown as Record<string, unknown>).tags;
          return Array.isArray(tags) && tags.some((t: string) => tagSet.has(t));
        });
      }

      events = filtered.slice(0, limit);

      // For mixed sections, prepend curated items
      if (section.section_type === "mixed") {
        const curatedItems = (section.portal_section_items || [])
          .filter((item) => item.entity_type === "event")
          .sort((a, b) => a.display_order - b.display_order);
        const curatedEvents = curatedItems
          .map((item) => eventMap.get(item.entity_id))
          .filter((e): e is FeedEventData => e !== undefined);
        const curatedIds = new Set(curatedEvents.map((e) => e.id));
        events = [...curatedEvents, ...events.filter((e) => !curatedIds.has(e.id))].slice(0, limit);
      }
    }

    return {
      id: section.id,
      title: section.title,
      slug: section.slug,
      description: section.description,
      section_type: section.section_type,
      block_type: section.block_type,
      layout: section.layout,
      items_per_row: section.items_per_row,
      style: section.style,
      block_content: section.block_content,
      auto_filter: section.auto_filter as FeedSectionData["auto_filter"],
      events,
    } as FeedSectionData;
  });
}
