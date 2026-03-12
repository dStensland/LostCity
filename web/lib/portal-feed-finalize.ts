import { dedupeSectionEventsById } from "@/lib/event-feed-health";
import { shouldKeepPortalSection } from "@/lib/portal-section-presentation";

type EventWithId = {
  id: number;
  [key: string]: unknown;
};

type SectionWithBlockType<T extends EventWithId> = {
  id: string;
  block_type: string;
  events: T[];
  [key: string]: unknown;
};

type HolidaySectionMeta = {
  id: string;
  display_order: number;
  max_items: number;
  auto_filter?: {
    tags?: string[];
  } | null;
  [key: string]: unknown;
};

export function buildPortalHolidayFeedSections<
  T extends EventWithId,
  S extends HolidaySectionMeta,
>(
  holidaySections: S[],
  holidayEventsByTag: Map<string, T[]>,
): Array<
  Omit<S, "max_items"> & {
    events: T[];
  }
> {
  return holidaySections.map((section) => {
    const tag = section.auto_filter?.tags?.[0];
    const events = tag
      ? (holidayEventsByTag.get(tag) || []).slice(0, section.max_items || 20)
      : [];

    return {
      ...section,
      events,
    };
  });
}

export function finalizePortalFeedSections<
  T extends EventWithId,
  S extends SectionWithBlockType<T>,
>(
  feedSections: S[],
  holidayFeedSections: S[],
  holidayOrderById: Map<string, number>,
): S[] {
  const sortedHolidaySections = holidayFeedSections
    .filter((section) => section.events.length > 0)
    .sort(
      (left, right) =>
        (holidayOrderById.get(left.id) ?? 0) - (holidayOrderById.get(right.id) ?? 0),
    );

  const finalSections = dedupeSectionEventsById([
    ...sortedHolidaySections,
    ...feedSections,
  ]);

  return finalSections.filter((section) =>
    shouldKeepPortalSection({
      blockType: section.block_type,
      eventCount: section.events.length,
    }),
  );
}

export function attachPortalSocialCounts<
  T extends EventWithId,
  S extends SectionWithBlockType<T>,
>(
  sections: S[],
  socialCounts: Map<
    number,
    { going: number; interested: number; recommendations: number }
  >,
): Array<
  Omit<S, "events"> & {
    events: Array<
      T & {
        going_count: number;
        interested_count: number;
        recommendation_count: number;
      }
    >;
  }
> {
  return sections.map((section) => ({
    ...section,
    events: section.events.map((event) => {
      const eventCounts = socialCounts.get(event.id);
      return {
        ...event,
        going_count: eventCounts?.going || 0,
        interested_count: eventCounts?.interested || 0,
        recommendation_count: eventCounts?.recommendations || 0,
      };
    }),
  }));
}
