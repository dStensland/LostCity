import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getPortalBySlug } from "@/lib/portal";
import { getPortalSourceAccess } from "@/lib/federation";
import { getLocalDateString, getLocalDateStringOffset } from "@/lib/formats";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";
import {
  applyFederatedPortalScopeToQuery,
  expandCityFilterForMetro,
} from "@/lib/portal-scope";
import { applyFeedGate } from "@/lib/feed-gate";
import { getGameDayPayload } from "./game-day";
import { getRegularsPayload } from "./regulars";
import type { LaneSlug } from "@/lib/types/explore-home";

type RpcLaneCounts = {
  count: number | null;
  count_today: number | null;
  count_weekend: number | null;
};

const CACHE_NAMESPACE = "explore-home:fallback";
const CACHE_TTL_MS = 2 * 60 * 1000;

function getWeekendRange(today: Date): { start: string; end: string } {
  const dayOfWeek = today.getDay();
  const fri = new Date(today);
  const sun = new Date(today);

  if (dayOfWeek === 0) {
    fri.setDate(fri.getDate() - 2);
  } else if (dayOfWeek === 6) {
    fri.setDate(fri.getDate() - 1);
    sun.setDate(sun.getDate() + 1);
  } else if (dayOfWeek === 5) {
    sun.setDate(sun.getDate() + 2);
  } else {
    const daysToFri = 5 - dayOfWeek;
    fri.setDate(fri.getDate() + daysToFri);
    sun.setDate(sun.getDate() + daysToFri + 2);
  }

  return {
    start: getLocalDateString(fri),
    end: getLocalDateString(sun),
  };
}

async function countScopedEvents({
  portalId,
  portalExclusive,
  sourceIds,
  expandedCities,
  startDate,
  endDate,
  categoryIds,
  excludeClasses,
  requireShowtime,
  regularReadyOnly,
  classesOnly,
}: {
  portalId: string;
  portalExclusive: boolean;
  sourceIds: number[];
  expandedCities: string[];
  startDate?: string;
  endDate?: string;
  categoryIds?: string[];
  excludeClasses?: boolean;
  requireShowtime?: boolean;
  regularReadyOnly?: boolean;
  classesOnly?: boolean;
}): Promise<number> {
  const supabase = await createClient();
  let query = supabase
    .from("events")
    .select("id, venue:places!events_place_id_fkey(city)", {
      count: "exact",
      head: true,
    })
    .is("canonical_event_id", null);

  if (startDate) query = query.gte("start_date", startDate);
  if (endDate) query = query.lte("start_date", endDate);
  if (categoryIds?.length) query = query.in("category_id", categoryIds);
  if (excludeClasses) query = query.or("is_class.eq.false,is_class.is.null");
  if (classesOnly) query = query.eq("is_class", true);
  if (regularReadyOnly) {
    query = query
      .eq("is_regular_ready", true)
      .not("series_id", "is", null)
      .not(
        "category_id",
        "in",
        "(film,theater,education,support,support_group,civic,volunteer,religious,community,family,learning)",
      )
      .not("tags", "cs", '{"class"}');
  }
  if (requireShowtime) {
    query = query.contains("tags", ["showtime"]).not("start_time", "is", null);
  }

  query = applyFeedGate(query);
  query = applyFederatedPortalScopeToQuery(query, {
    portalId,
    portalExclusive,
    publicOnlyWhenNoPortal: true,
    sourceIds,
  });

  if (expandedCities.length > 0) {
    query = (
      query as unknown as {
        filter: (column: string, operator: string, value: string) => typeof query;
      }
    ).filter("places.city", "in", `(${expandedCities.join(",")})`) as typeof query;
  }

  const { count } = await query;
  return count ?? 0;
}

async function countPlaces({
  portalCity,
}: {
  portalCity: string;
}): Promise<number> {
  const supabase = await createClient();
  const expandedCities = expandCityFilterForMetro([portalCity]);
  const { count } = await supabase
    .from("places")
    .select("id", { count: "exact", head: true })
    .neq("is_active", false)
    .in("city", expandedCities);
  return count ?? 0;
}

function countUniqueGames(
  teams: Awaited<ReturnType<typeof getGameDayPayload>>["teams"],
  predicate?: (date: string) => boolean,
): number {
  const ids = new Set<number>();
  for (const team of teams) {
    const games = [
      ...(team.nextGame ? [team.nextGame] : []),
      ...team.upcoming,
    ];
    for (const game of games) {
      if (predicate && !predicate(game.startDate)) continue;
      ids.add(game.id);
    }
  }
  return ids.size;
}

export async function getExploreHomeFallbackCounts(
  portalSlug: string,
): Promise<Record<LaneSlug, RpcLaneCounts> | null> {
  const portal = await getPortalBySlug(portalSlug);
  if (!portal) return null;

  const now = new Date();
  const today = getLocalDateString(now);
  const weekEnd = getLocalDateStringOffset(7);
  const etNow = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  const weekend = getWeekendRange(etNow);
  const isCurrentlyWeekend = [0, 5, 6].includes(etNow.getDay());
  const weekendStart = isCurrentlyWeekend ? today : weekend.start;
  const portalCity = (portal.filters as { city?: string } | null)?.city || "Atlanta";
  const expandedCities = expandCityFilterForMetro([portalCity]);
  const portalExclusive = false;

  return getOrSetSharedCacheJson<Record<LaneSlug, RpcLaneCounts>>(
    CACHE_NAMESPACE,
    `${portal.id}|${today}`,
    CACHE_TTL_MS,
    async () => {
      const sourceAccess = await getPortalSourceAccess(portal.id);

      const [
        eventsCounts,
        showCounts,
        classesCounts,
        placesCount,
        regularsPayload,
        gameDayPayload,
      ] = await Promise.all([
        Promise.all([
          countScopedEvents({
            portalId: portal.id,
            portalExclusive,
            sourceIds: sourceAccess.sourceIds,
            expandedCities,
            startDate: today,
            endDate: weekEnd,
            excludeClasses: true,
          }),
          countScopedEvents({
            portalId: portal.id,
            portalExclusive,
            sourceIds: sourceAccess.sourceIds,
            expandedCities,
            startDate: today,
            endDate: today,
            excludeClasses: true,
          }),
          countScopedEvents({
            portalId: portal.id,
            portalExclusive,
            sourceIds: sourceAccess.sourceIds,
            expandedCities,
            startDate: weekendStart,
            endDate: weekend.end,
            excludeClasses: true,
          }),
        ]),
        Promise.all([
          Promise.all(
            [["film"], ["music"], ["theater", "dance"], ["comedy"]].map((categories) =>
              countScopedEvents({
                portalId: portal.id,
                portalExclusive,
                sourceIds: sourceAccess.sourceIds,
                expandedCities,
                startDate: today,
                endDate: weekEnd,
                categoryIds: categories,
                requireShowtime: categories[0] === "film",
              }),
            ),
          ),
          Promise.all(
            [["film"], ["music"], ["theater", "dance"], ["comedy"]].map((categories) =>
              countScopedEvents({
                portalId: portal.id,
                portalExclusive,
                sourceIds: sourceAccess.sourceIds,
                expandedCities,
                startDate: today,
                endDate: today,
                categoryIds: categories,
                requireShowtime: categories[0] === "film",
              }),
            ),
          ),
          Promise.all(
            [["film"], ["music"], ["theater", "dance"], ["comedy"]].map((categories) =>
              countScopedEvents({
                portalId: portal.id,
                portalExclusive,
                sourceIds: sourceAccess.sourceIds,
                expandedCities,
                startDate: weekendStart,
                endDate: weekend.end,
                categoryIds: categories,
                requireShowtime: categories[0] === "film",
              }),
            ),
          ),
        ]),
        Promise.all([
          countScopedEvents({
            portalId: portal.id,
            portalExclusive,
            sourceIds: sourceAccess.sourceIds,
            expandedCities,
            startDate: today,
            endDate: weekEnd,
            classesOnly: true,
          }),
          countScopedEvents({
            portalId: portal.id,
            portalExclusive,
            sourceIds: sourceAccess.sourceIds,
            expandedCities,
            startDate: today,
            endDate: today,
            classesOnly: true,
          }),
          countScopedEvents({
            portalId: portal.id,
            portalExclusive,
            sourceIds: sourceAccess.sourceIds,
            expandedCities,
            startDate: weekendStart,
            endDate: weekend.end,
            classesOnly: true,
          }),
        ]),
        countPlaces({ portalCity }),
        getRegularsPayload({
          searchParams: new URLSearchParams({ portal_id: portal.id }),
        }),
        getGameDayPayload(portal.slug),
      ]);

      const regularsEvents = regularsPayload.events;
      const regularsToday = regularsEvents.filter((event) => event.start_date === today).length;
      const regularsWeekend = regularsEvents.filter(
        (event) => event.start_date >= weekendStart && event.start_date <= weekend.end,
      ).length;

      const gameDayCount = countUniqueGames(gameDayPayload.teams);
      const gameDayToday = countUniqueGames(
        gameDayPayload.teams,
        (date) => date === today,
      );
      const gameDayWeekend = countUniqueGames(
        gameDayPayload.teams,
        (date) => date >= weekendStart && date <= weekend.end,
      );

      const [eventsTotal, eventsToday, eventsWeekend] = eventsCounts;
      const [showsTotalParts, showsTodayParts, showsWeekendParts] = showCounts;
      const [classesTotal, classesToday, classesWeekend] = classesCounts;

      return {
        events: {
          count: eventsTotal,
          count_today: eventsToday,
          count_weekend: eventsWeekend,
        },
        shows: {
          count: showsTotalParts.reduce((sum, count) => sum + count, 0),
          count_today: showsTodayParts.reduce((sum, count) => sum + count, 0),
          count_weekend: showsWeekendParts.reduce((sum, count) => sum + count, 0),
        },
        "game-day": {
          count: gameDayCount,
          count_today: gameDayToday,
          count_weekend: gameDayWeekend,
        },
        regulars: {
          count: regularsEvents.length,
          count_today: regularsToday,
          count_weekend: regularsWeekend,
        },
        classes: {
          count: classesTotal,
          count_today: classesToday,
          count_weekend: classesWeekend,
        },
        places: {
          count: placesCount,
          count_today: null,
          count_weekend: null,
        },
      };
    },
  );
}
