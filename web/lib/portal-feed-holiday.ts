/**
 * Holiday event fetching for the portal feed.
 *
 * Extracted from the feed route's "Step 5" block. Fetches events that match
 * holiday tags for the programmatic holiday sections returned by
 * `buildPortalHolidaySections`, groups them by tag, and returns both the
 * per-tag index and a flat map of all holiday events (for the main event map).
 */

import { applyFeedGate } from "@/lib/feed-gate";
import { suppressEventImagesIfVenueFlagged } from "@/lib/image-quality-suppression";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";
import { getPortalFeedDateRange } from "@/lib/portal-feed-section-rules";
import { createServerTimingRecorder } from "@/lib/server-timing";
import { SupabaseClient } from "@supabase/supabase-js";

const HOLIDAY_EVENTS_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const HOLIDAY_EVENTS_CACHE_NAMESPACE = "api:portal-feed:holidays";
const FEED_CACHE_MAX_ENTRIES = 200;

type HolidayEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  category: string | null;
  genres?: string[] | null;
  image_url: string | null;
  description: string | null;
  featured_blurb: string | null;
  tags?: string[] | null;
  festival_id?: string | null;
  is_tentpole?: boolean;
  series_id?: string | null;
  series?: {
    id: string;
    slug: string;
    title: string;
    series_type: string;
    image_url: string | null;
    frequency: string | null;
    day_of_week: string | null;
    festival?: {
      id: string;
      slug: string;
      name: string;
      image_url: string | null;
      festival_type?: string | null;
      location: string | null;
      neighborhood: string | null;
    } | null;
  } | null;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
    slug: string | null;
    venue_type: string | null;
    location_designator:
      | "standard"
      | "private_after_signup"
      | "virtual"
      | "recovery_meeting"
      | null;
    city: string | null;
    active?: boolean | null;
  } | null;
};

type HolidaySectionInput = {
  id: string;
  display_order: number;
  max_items: number;
  auto_filter?: {
    date_filter?: string;
    tags?: string[];
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

export type FetchHolidayEventsParams = {
  portalClient: SupabaseClient;
  holidaySections: HolidaySectionInput[];
  portalCities: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applyPortalEventScope: (query: any) => any;
  today: string;
  portalId: string;
  timing: ReturnType<typeof createServerTimingRecorder>;
};

export type FetchHolidayEventsResult = {
  /** Events grouped by the holiday tag they matched */
  holidayEventsByTag: Map<string, HolidayEvent[]>;
  /** Flat map of all holiday events, keyed by event id, for merging into eventMap */
  allHolidayEvents: Map<number, HolidayEvent>;
};

/**
 * Fetches events for programmatic holiday sections and returns them grouped by tag.
 *
 * Uses a two-phase query: first a lightweight candidates query filtered by tags
 * and city, then a full-detail query on the matching IDs. Results are cached for
 * 12 hours per (portal, date, city, tag-group) combination.
 */
export async function fetchHolidayEvents(
  params: FetchHolidayEventsParams,
): Promise<FetchHolidayEventsResult> {
  const {
    portalClient,
    holidaySections,
    portalCities,
    applyPortalEventScope,
    today,
    portalId,
    timing,
  } = params;

  const holidayEventsByTag = new Map<string, HolidayEvent[]>();
  const allHolidayEvents = new Map<number, HolidayEvent>();

  if (holidaySections.length === 0) {
    return { holidayEventsByTag, allHolidayEvents };
  }

  const holidayCityKey =
    portalCities.length > 0 ? portalCities.join(",") : "all";

  // Group sections by date_filter so we can batch the DB queries per date range
  const holidayGroups = Array.from(
    holidaySections
      .reduce(
        (
          groups,
          section,
        ) => {
          const dateFilter = section.auto_filter?.date_filter;
          const tag = section.auto_filter?.tags?.[0];
          if (!dateFilter || !tag) {
            return groups;
          }

          const existing = groups.get(dateFilter) || {
            dateFilter,
            tags: new Set<string>(),
            sectionCapacity: 0,
          };
          existing.tags.add(tag);
          existing.sectionCapacity += Math.max(
            1,
            Math.min(section.max_items || 20, 24),
          );
          groups.set(dateFilter, existing);
          return groups;
        },
        new Map<
          string,
          {
            dateFilter: string;
            tags: Set<string>;
            sectionCapacity: number;
          }
        >(),
      )
      .values(),
  );

  if (holidayGroups.length === 0) {
    return { holidayEventsByTag, allHolidayEvents };
  }

  const mergedHolidayEvents = new Map<number, HolidayEvent>();

  for (const group of holidayGroups) {
    const groupTags = Array.from(group.tags).sort();
    const groupEndDate = getPortalFeedDateRange(group.dateFilter).end;
    const holidayCacheKey = [
      portalId,
      today,
      holidayCityKey,
      group.dateFilter,
      groupEndDate,
      groupTags.join(","),
    ].join("|");
    const holidayFetchLimit = Math.min(
      96,
      Math.max(
        24,
        groupTags.length * 10,
        group.sectionCapacity + Math.max(6, groupTags.length * 3),
      ),
    );

    let holidayEvents = await timing.measure(
      "holidays_cache_lookup",
      () =>
        getSharedCacheJson<HolidayEvent[]>(
          HOLIDAY_EVENTS_CACHE_NAMESPACE,
          holidayCacheKey,
        ),
      group.dateFilter,
    );

    if (!holidayEvents) {
      // Phase 1: lightweight candidates query (id + tags + venue city only)
      let holidayCandidateQuery = portalClient
        .from("events")
        .select(
          `
          id,
          start_date,
          tags,
          venue:places(id, city, is_active)
        `,
        )
        .overlaps("tags", groupTags)
        .gte("start_date", today)
        .lte("start_date", groupEndDate)
        .is("canonical_event_id", null)
        .or("is_class.eq.false,is_class.is.null")
        .or("is_sensitive.eq.false,is_sensitive.is.null");
      holidayCandidateQuery = applyFeedGate(holidayCandidateQuery);
      holidayCandidateQuery = applyPortalEventScope(holidayCandidateQuery);

      const { data: holidayCandidates } = await timing.measure(
        "holidays_candidates_query",
        () =>
          holidayCandidateQuery
            .order("start_date", { ascending: true })
            .order("data_quality", { ascending: false, nullsFirst: false })
            .limit(holidayFetchLimit),
        group.dateFilter,
      );

      // Phase 1b: filter by city
      const holidayCandidateIds = await timing.measure(
        "holidays_filter",
        async () => {
          const filteredIds: number[] = [];
          for (const event of (holidayCandidates ||
            []) as Array<{
            id: number;
            venue?: { city?: string | null; active?: boolean | null } | null;
          }>) {
            if (event.venue?.active === false) {
              continue;
            }
            if (portalCities.length > 0 && event.venue?.city) {
              const venueCity = event.venue.city.trim().toLowerCase();
              if (
                venueCity &&
                !portalCities.some((pc) => {
                  if (venueCity === pc) return true;
                  const regex = new RegExp(
                    `\\b${pc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
                  );
                  return regex.test(venueCity);
                })
              ) {
                continue;
              }
            }
            filteredIds.push(event.id);
          }
          return filteredIds;
        },
        group.dateFilter,
      );

      // Phase 2: full detail query on matched IDs
      if (holidayCandidateIds.length > 0) {
        let holidayDetailsQuery = portalClient
          .from("events")
          .select(
            `
            id,
            title,
            start_date,
            start_time,
            end_date,
            end_time,
            is_all_day,
            is_free,
            price_min,
            price_max,
            category:category_id,
            genres,
            image_url,
            description,
            featured_blurb,
            tags,
            festival_id,
            is_tentpole,
            series_id,
            series:series_id(
              id,
              slug,
              title,
              series_type,
              image_url,
              frequency,
              day_of_week,
              festival:festivals(id, slug, name, image_url, festival_type, location, neighborhood)
            ),
            venue:places(id, name, neighborhood, slug, place_type, location_designator, city, image_url, is_active)
          `,
          )
          .in("id", holidayCandidateIds);
        holidayDetailsQuery = applyFeedGate(holidayDetailsQuery);
        holidayDetailsQuery = applyPortalEventScope(holidayDetailsQuery);

        const { data: holidayDetailRows } = await timing.measure(
          "holidays_details_query",
          () =>
            holidayDetailsQuery
              .order("start_date", { ascending: true })
              .order("data_quality", { ascending: false, nullsFirst: false }),
          group.dateFilter,
        );

        const holidayEventsById = new Map(
          suppressEventImagesIfVenueFlagged(
            (holidayDetailRows as unknown as HolidayEvent[]) || [],
          ).map((event) => [event.id, event]),
        );
        holidayEvents = holidayCandidateIds
          .map((eventId) => holidayEventsById.get(eventId))
          .filter(
            (event): event is HolidayEvent => event !== undefined,
          );
      } else {
        holidayEvents = [];
      }

      await timing.measure(
        "holidays_cache_store",
        () =>
          setSharedCacheJson(
            HOLIDAY_EVENTS_CACHE_NAMESPACE,
            holidayCacheKey,
            holidayEvents,
            HOLIDAY_EVENTS_CACHE_TTL_MS,
            { maxEntries: 80 },
          ),
        group.dateFilter,
      );
    }

    await timing.measure(
      "holidays_index",
      async () => {
        for (const typedEvent of holidayEvents!) {
          mergedHolidayEvents.set(typedEvent.id, typedEvent);

          for (const tag of groupTags) {
            if (typedEvent.tags?.includes(tag)) {
              if (!holidayEventsByTag.has(tag)) {
                holidayEventsByTag.set(tag, []);
              }
              holidayEventsByTag.get(tag)!.push(typedEvent);
            }
          }
        }
      },
      group.dateFilter,
    );
  }

  for (const [id, event] of mergedHolidayEvents) {
    allHolidayEvents.set(id, event);
  }

  return { holidayEventsByTag, allHolidayEvents };
}

// Re-export the cache constants so portal-feed-loader can share the same namespace
export {
  HOLIDAY_EVENTS_CACHE_TTL_MS,
  HOLIDAY_EVENTS_CACHE_NAMESPACE,
  FEED_CACHE_MAX_ENTRIES as HOLIDAY_FEED_CACHE_MAX_ENTRIES,
};
