import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import {
  resolvePortalQueryContext,
  type PortalQueryContext,
} from "@/lib/portal-query-context";
import {
  applyFederatedPortalScopeToQuery,
  excludeSensitiveEvents,
  expandCityFilterForMetro,
} from "@/lib/portal-scope";
import { getPortalSourceAccess } from "@/lib/federation";
import { getLocalDateString } from "@/lib/formats";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";
import {
  dedupeEventsById,
  dedupeEventsFuzzy,
  filterOutInactiveVenueEvents,
} from "@/lib/event-feed-health";
import { applyVenueGate } from "@/lib/feed-gate";
import { createLogger } from "@/lib/logger";
import { matchActivityType } from "@/lib/scene-event-routing";
import { buildRecurrenceLabel } from "@/lib/city-pulse/section-builders";
import type { ExploreLaneServerLoaderArgs } from "@/lib/explore-platform/types";
import type {
  RegularsLaneEvent,
  RegularsLaneInitialData,
} from "@/lib/explore-platform/lane-data";

const logger = createLogger("regulars");

const CACHE_NAMESPACE = "api:regulars";
const CACHE_TTL_MS = 3 * 60 * 1000;

const EVENT_SELECT = `
  id, title, start_date, start_time,
  is_all_day,
  category:category_id, genres, tags,
  series:series_id(day_of_week, frequency),
  venue:places(id, name, neighborhood, city, is_active)
`;

type RegularsQueryOptions = {
  searchParams: URLSearchParams;
  vertical?: { verticalSlug?: string | null };
};

type RawRegularEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_all_day: boolean | null;
  category: string | null;
  genres: string[] | null;
  tags: string[] | null;
  series:
    | {
        day_of_week: string | null;
        frequency: string | null;
      }
    | Array<{
        day_of_week: string | null;
        frequency: string | null;
      }>
    | null;
  venue:
    | {
        id?: number | null;
        name?: string | null;
        neighborhood?: string | null;
        city?: string | null;
        is_active?: boolean | null;
      }
    | null;
};

export interface RegularsApiEvent extends RawRegularEvent {
  activity_type: string | null;
  recurrence_label: string | null;
}

function computeWeekdayDates(
  weekdayParam: string,
  startDate: string,
  endDate: string,
): string[] {
  const weekdayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const targetDays = weekdayParam
    .toLowerCase()
    .split(",")
    .map((value) => weekdayMap[value.trim()])
    .filter((value) => value !== undefined);

  if (targetDays.length === 0) return [];

  const dates: string[] = [];
  const current = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);

  while (current <= end) {
    if (targetDays.includes(current.getDay())) {
      dates.push(getLocalDateString(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function getSeriesObject(
  series:
    | RawRegularEvent["series"]
    | undefined,
): { day_of_week: string | null; frequency: string | null } | null {
  if (!series) return null;
  if (Array.isArray(series)) {
    return series[0] ?? null;
  }
  return series;
}

function classifyRegularEvent(event: RawRegularEvent): RegularsApiEvent {
  const pseudoEvent = {
    ...event,
    category: event.category,
    series: getSeriesObject(event.series),
  } as never;

  return {
    ...event,
    series: getSeriesObject(event.series),
    activity_type: matchActivityType(pseudoEvent),
    recurrence_label: buildRecurrenceLabel(pseudoEvent) ?? null,
  };
}

function toCompactRegularEvent(event: RegularsApiEvent): RegularsLaneEvent {
  return {
    id: event.id,
    title: event.title,
    start_date: event.start_date,
    start_time: event.start_time,
    is_all_day: event.is_all_day,
    venue: {
      name: event.venue?.name ?? null,
    },
    activity_type: event.activity_type,
    recurrence_label: event.recurrence_label,
  };
}

export async function getRegularsPayload(
  options: RegularsQueryOptions,
): Promise<{ events: RegularsApiEvent[] }> {
  const supabase = await createClient();
  const portalContext: PortalQueryContext = await resolvePortalQueryContext(
    supabase,
    options.searchParams,
    options.vertical,
  );

  const weekdayParam = options.searchParams.get("weekday");
  const portalExclusive = options.searchParams.get("portal_exclusive") === "true";
  const rangeParam = options.searchParams.get("range");
  const rangeDays = rangeParam === "30" ? 30 : 7;

  const portalId = portalContext.portalId;
  const sourceAccess = portalId ? await getPortalSourceAccess(portalId) : null;
  const portalCity = !portalExclusive ? portalContext.filters.city : undefined;

  const now = new Date();
  const today = getLocalDateString(now);
  const dateAhead = getLocalDateString(
    new Date(now.getTime() + rangeDays * 24 * 60 * 60 * 1000),
  );

  const cacheBucket = Math.floor(Date.now() / CACHE_TTL_MS);
  const cacheKey = [
    portalId || "no-portal",
    portalCity || "all-cities",
    weekdayParam || "all-days",
    rangeParam || "7",
    cacheBucket,
  ].join("|");

  return getOrSetSharedCacheJson<{ events: RegularsApiEvent[] }>(
    CACHE_NAMESPACE,
    cacheKey,
    CACHE_TTL_MS,
    async () => {
      let query = supabase
        .from("events")
        .select(EVENT_SELECT)
        .gte("start_date", today)
        .lte("start_date", dateAhead)
        .not("series_id", "is", null)
        .is("canonical_event_id", null)
        .eq("is_regular_ready", true)
        .not("is_class", "eq", true)
        .not(
          "category_id",
          "in",
          "(film,theater,education,support,support_group,civic,volunteer,religious,community,family,learning)",
        )
        .not("tags", "cs", '{"class"}');

      query = applyVenueGate(query);
      query = applyFederatedPortalScopeToQuery(query, {
        portalId,
        portalExclusive,
        publicOnlyWhenNoPortal: true,
        sourceIds: sourceAccess?.sourceIds ?? [],
      });
      query = excludeSensitiveEvents(query);

      if (portalCity) {
        const expandedCities = expandCityFilterForMetro([portalCity]);
        query = (
          query as unknown as {
            filter: (column: string, operator: string, value: string) => typeof query;
          }
        ).filter("places.city", "in", `(${expandedCities.join(",")})`) as typeof query;
      }

      if (weekdayParam) {
        const targetDates = computeWeekdayDates(weekdayParam, today, dateAhead);
        if (targetDates.length > 0) {
          query = query.in("start_date", targetDates);
        }
      }

      query = query
        .order("start_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(1000);

      const { data, error } = await query;
      if (error) {
        logger.error("[regulars] Query error", { error: error.message });
        throw error;
      }

      let events = ((data as RawRegularEvent[] | null) ?? []) as Array<
        RawRegularEvent & { [key: string]: unknown }
      >;
      events = dedupeEventsById(events);
      events = dedupeEventsFuzzy(events) as typeof events;
      events = filterOutInactiveVenueEvents(events) as typeof events;

      const classifiedEvents = events
        .map((event) => classifyRegularEvent(event))
        .filter((event) => event.activity_type);

      return { events: classifiedEvents };
    },
  );
}

export async function getExploreRegularsInitialData({
  portalId,
  portalSlug,
  portalExclusive,
  params,
}: ExploreLaneServerLoaderArgs): Promise<RegularsLaneInitialData | null> {
  const searchParams = new URLSearchParams(params.toString());
  searchParams.set("portal_id", portalId);
  if (portalExclusive) {
    searchParams.set("portal_exclusive", "true");
  }

  const payload = await getRegularsPayload({ searchParams });
  const today = getLocalDateString(new Date());

  return {
    events: payload.events.map(toCompactRegularEvent),
    requestKey: `${portalSlug}|regulars|${today}`,
  };
}

export async function runRegularsRateLimit(request: Request) {
  return applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
}
