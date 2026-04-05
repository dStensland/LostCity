/**
 * Server-side data fetcher for the Explore Home dashboard.
 *
 * Resolves the portal, then calls the `get_explore_home_counts` SQL function
 * via a single Supabase RPC to get all lane counts in one query. Each lane gets:
 *   - count (total items)
 *   - count_today / count_weekend (for alive/quiet scoring)
 *   - state: "alive" | "quiet" | "zero"
 *   - copy: human-readable summary
 *
 * No preview items are fetched — the search-forward ExploreHome layout
 * uses lane tiles with counts/copy only; actual content is loaded when
 * the user navigates into a lane.
 *
 * Called by the API route which adds HTTP caching on top.
 */

import { createPortalScopedClient } from "@/lib/supabase/server";
import { getCachedPortalBySlug } from "@/lib/portal";
import { getTimeSlot, isWeekend } from "@/lib/city-pulse/time-slots";
import { getLocalDateString, getLocalDateStringOffset } from "@/lib/formats";
import { getPortalSourceAccess } from "@/lib/federation";
import { buildExploreHomePayload } from "@/lib/explore-platform/home";
import { getExploreHomeFallbackCounts } from "@/lib/explore-platform/server/home-fallback";
import {
  getSharedCacheJson,
  setSharedCacheJson,
} from "@/lib/shared-cache";
import type { Portal } from "@/lib/portal-context";
import type { PortalSourceAccess } from "@/lib/federation";
import type {
  ExploreHomeResponse,
  LanePreview,
  LaneSlug,
  LaneState,
} from "@/lib/types/explore-home";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** All lane slugs the RPC returns counts for. */
const LANE_SLUGS: LaneSlug[] = [
  "events",
  "shows",
  "game-day",
  "regulars",
  "classes",
  "places",
];

/** Lanes where today/weekend counts are not applicable (non-temporal). */
const NON_TEMPORAL_LANES: ReadonlySet<LaneSlug> = new Set([
  "places",
]);
const EXPLORE_HOME_CACHE_NAMESPACE = "explore-home:data";
const EXPLORE_HOME_CACHE_TTL_MS = 2 * 60 * 1000;
const EXPLORE_HOME_LATEST_CACHE_KEY_SUFFIX = "latest";
const EXPLORE_HOME_LATEST_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const EXPLORE_HOME_CACHE_MAX_ENTRIES = 50;

/** Weekend date range: Friday through Sunday (inclusive).
 *  On Fri -> today through Sun. On Sat -> yesterday Fri through tomorrow Sun.
 *  On Sun -> Fri (2 days ago) through today. Mon-Thu -> next Fri through next Sun. */
function getWeekendRange(today: Date): { start: string; end: string } {
  const dayOfWeek = today.getDay(); // 0=Sun, 6=Sat
  const fri = new Date(today);
  const sun = new Date(today);

  if (dayOfWeek === 0) {
    // Sunday: Friday was 2 days ago, sun is today
    fri.setDate(fri.getDate() - 2);
  } else if (dayOfWeek === 6) {
    // Saturday: Friday was yesterday, Sunday is tomorrow
    fri.setDate(fri.getDate() - 1);
    sun.setDate(sun.getDate() + 1);
  } else if (dayOfWeek === 5) {
    // Friday: today through Sunday
    sun.setDate(sun.getDate() + 2);
  } else {
    // Mon-Thu: next weekend
    const daysToFri = 5 - dayOfWeek;
    fri.setDate(fri.getDate() + daysToFri);
    sun.setDate(sun.getDate() + daysToFri + 2);
  }

  return {
    start: getLocalDateString(fri),
    end: getLocalDateString(sun),
  };
}

// ---------------------------------------------------------------------------
// Lane state scoring
// ---------------------------------------------------------------------------

/**
 * Compute alive/quiet/zero state from lane metrics.
 *
 * Scoring:
 *   - Has content today/tonight: +3
 *   - Has content this weekend:  +2
 *   - Item count above threshold: +1
 *   - Time-of-day boost:         +0-2
 *
 * Score >= 3 -> alive, score > 0 -> quiet, 0 items -> zero.
 *
 * Non-temporal lanes (todayCount === null && weekendCount === null):
 *   today/weekend are not applicable -- alive when totalCount >= 3.
 */
function computeLaneState(
  totalCount: number,
  todayCount: number | null,
  weekendCount: number | null,
  timeSlotBoost: number,
): LaneState {
  // Only declare "zero" when ALL counts are empty. If totalCount is 0 but
  // today/weekend have items, the total count query likely failed -- the lane
  // clearly isn't empty.
  const effectiveToday = todayCount ?? 0;
  const effectiveWeekend = weekendCount ?? 0;
  if (totalCount === 0 && effectiveToday === 0 && effectiveWeekend === 0) {
    return "zero";
  }

  // Non-temporal lanes: alive when count >= threshold
  if (todayCount === null && weekendCount === null) {
    return totalCount >= 3 ? "alive" : "quiet";
  }

  let score = 0;
  if (effectiveToday > 0) score += 3;
  if (effectiveWeekend > 0) score += 2;
  if (totalCount >= 5) score += 1;
  score += timeSlotBoost;

  if (score >= 3) return "alive";
  if (score > 0) return "quiet";
  return "zero";
}

/**
 * Time-of-day boost for lane scoring.
 * Music and stage get boosts during evening/late_night.
 * Film gets a boost during midday+ (matinees).
 * Events get a small boost during evening.
 */
function getTimeBoostForLane(lane: LaneSlug, hour: number): number {
  const slot = getTimeSlot(hour);

  switch (lane) {
    case "shows":
      if (slot === "evening" || slot === "late_night") return 2;
      if (slot === "happy_hour") return 1;
      return 0;
    case "events":
      if (slot === "evening") return 1;
      return 0;
    case "regulars":
      if (slot === "evening" || slot === "happy_hour") return 1;
      return 0;
    case "game-day":
      // Games typically tip off in the evening
      if (slot === "evening" || slot === "late_night") return 2;
      if (slot === "happy_hour") return 1;
      return 0;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Quiet-state copy generation
// ---------------------------------------------------------------------------

function generateLaneCopy(
  lane: LaneSlug,
  state: LaneState,
  totalCount: number,
  todayCount: number | null,
  weekendCount: number | null,
): string {
  if (state === "zero") {
    switch (lane) {
      case "events":
        return "No upcoming events found";
      case "shows":
        return "No shows scheduled";
      case "game-day":
        return "No games scheduled";
      case "regulars":
        return "No weekly regulars found";
      case "places":
        return "No places listed yet";
      case "classes":
        return "Classes coming soon";
      default:
        return "Nothing to browse right now";
    }
  }

  if (state === "alive") {
    if ((todayCount ?? 0) > 0) {
      switch (lane) {
        case "events":
          return `${todayCount} event${todayCount === 1 ? "" : "s"} happening today`;
        case "shows":
          return `${todayCount} show${todayCount === 1 ? "" : "s"} tonight`;
        case "game-day":
          return `${todayCount} game${todayCount === 1 ? "" : "s"} today`;
        case "regulars":
          return `${todayCount} regular${todayCount === 1 ? "" : "s"} happening today`;
        case "classes":
          return `${todayCount} class${todayCount === 1 ? "" : "es"} today`;
        case "places":
          return `${totalCount} places to explore`;
        default:
          return `${todayCount} today`;
      }
    }
    // Alive but nothing specifically today -- use weekend or total
    if ((weekendCount ?? 0) > 0) {
      return `${weekendCount} this weekend`;
    }
    return `${totalCount} upcoming`;
  }

  // Quiet state -- informative nudge
  switch (lane) {
    case "events":
      return `${totalCount} event${totalCount === 1 ? "" : "s"} coming up this week`;
    case "shows":
      return `${totalCount} show${totalCount === 1 ? "" : "s"} this week`;
    case "game-day":
      return `${totalCount} game${totalCount === 1 ? "" : "s"} this week`;
    case "regulars":
      return `${totalCount} weekly regular${totalCount === 1 ? "" : "s"} in your city`;
    case "classes":
      return `${totalCount} class${totalCount === 1 ? "" : "es"} coming up`;
    case "places":
      return `${totalCount} places to explore`;
    default:
      return `${totalCount} available`;
  }
}

function buildExploreHomeCacheKey(portalSlug: string, now: Date): string {
  const hourEt = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  const timeSlot = getTimeSlot(hourEt);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(now);
  return `${portalSlug}|${timeSlot}|${today}`;
}

function shouldCacheExploreHomePayload(data: ExploreHomeResponse): boolean {
  const laneEntries = Object.entries(data.lanes);
  const nonClassesLanes = laneEntries.filter(([key]) => key !== "classes");
  const zeroCount = nonClassesLanes.filter(
    ([, lane]) => lane.state === "zero",
  ).length;
  return zeroCount <= Math.floor(nonClassesLanes.length / 2);
}

// ---------------------------------------------------------------------------
// RPC result shape
// ---------------------------------------------------------------------------

/** Shape of each lane's counts in the RPC JSONB result. */
interface RpcLaneCounts {
  count: number | null;
  count_today: number | null;
  count_weekend: number | null;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Fetch all Explore Home lane data for a portal.
 *
 * Returns null on fatal errors (portal not found, service client failure).
 * On RPC failure all lanes degrade to "zero" state rather than failing the
 * entire response.
 */
export async function getExploreHomeData(
  portalSlug: string,
  options?: {
    portal?: Portal | null;
    sourceAccess?: PortalSourceAccess | null;
  },
): Promise<ExploreHomeResponse | null> {
  try {
    const now = new Date();
    const cacheKey = buildExploreHomeCacheKey(portalSlug, now);
    const cached = await getSharedCacheJson<ExploreHomeResponse>(
      EXPLORE_HOME_CACHE_NAMESPACE,
      cacheKey,
    );
    if (cached) {
      return cached;
    }

    // 1. Resolve portal + source access
    const portal = options?.portal ?? await getCachedPortalBySlug(portalSlug);
    if (!portal) return null;

    const city =
      (portal.filters as { city?: string } | null)?.city || "Atlanta";

    const sourceAccess =
      options?.sourceAccess ?? await getPortalSourceAccess(portal.id);

    const supabase = await createPortalScopedClient(portal.id);

    // Date boundaries -- all time-of-day computation uses Eastern Time so
    // Vercel's UTC servers produce correct results for Atlanta.
    const today = getLocalDateString(now);
    const weekEnd = getLocalDateStringOffset(7); // 7-day lookahead

    // Build an ET-localized Date for day-of-week arithmetic (getDay, etc.)
    const etNow = new Date(
      now.toLocaleString("en-US", { timeZone: "America/New_York" }),
    );

    const weekend = getWeekendRange(etNow);
    const isCurrentlyWeekend = isWeekend(etNow);

    const hourEt = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        hour12: false,
      }).format(now),
    );
    const currentHour = hourEt;

    // Weekend start adjusts to today when we're already in the weekend,
    // matching the previous per-query behavior.
    const weekendStart = isCurrentlyWeekend ? today : weekend.start;

    // -----------------------------------------------------------------------
    // 2. Single RPC call replaces ~18 individual Supabase REST queries
    // -----------------------------------------------------------------------

    const { data: counts, error: rpcError } = await supabase.rpc(
      "get_explore_home_counts" as never,
      {
        p_portal_id: portal.id,
        p_source_ids:
          sourceAccess.sourceIds.length > 0 ? sourceAccess.sourceIds : null,
        p_today: today,
        p_week_end: weekEnd,
        p_weekend_start: weekendStart,
        p_weekend_end: weekend.end,
        p_city_filter: `${city}%`,
      } as never,
    );

    const rpcResultCandidate = (counts ?? {}) as Record<string, RpcLaneCounts>;
    const hasMalformedResult = LANE_SLUGS.some((slug) => {
      const value = rpcResultCandidate[slug];
      return !value || typeof value !== "object";
    });

    let rpcResult = rpcResultCandidate;
    if (rpcError || hasMalformedResult) {
      console.warn("[explore-home-data] Explore home RPC degraded, using fallback.", {
        rpcError,
        hasMalformedResult,
      });
      const fallbackCounts = await getExploreHomeFallbackCounts(portalSlug);
      if (fallbackCounts) {
        rpcResult = fallbackCounts;
      }
    }

    // -----------------------------------------------------------------------
    // 3. Assemble lane data (counts + state + copy, no preview items)
    // -----------------------------------------------------------------------

    const lanes = {} as Record<LaneSlug, LanePreview>;

    for (const slug of LANE_SLUGS) {
      const laneData = rpcResult[slug];
      const rawTotal = laneData?.count ?? 0;
      const isNonTemporal = NON_TEMPORAL_LANES.has(slug);

      // Non-temporal lanes don't use today/weekend counts for scoring
      const todayN = isNonTemporal ? null : (laneData?.count_today ?? 0);
      const weekendN = isNonTemporal ? null : (laneData?.count_weekend ?? 0);

      // If the total count came back 0 but sub-counts have data, use the
      // best sub-count as the display total so copy doesn't say "0 regulars".
      const total =
        rawTotal > 0
          ? rawTotal
          : Math.max(todayN ?? 0, weekendN ?? 0, rawTotal);

      if (rawTotal === 0 && total > 0) {
        console.warn(
          `[explore-home-data] Lane "${slug}" total count is 0 but sub-counts have data (today=${todayN}, weekend=${weekendN}).`,
        );
      }

      const boost = getTimeBoostForLane(slug, currentHour);
      const state = computeLaneState(total, todayN, weekendN, boost);
      const copy = generateLaneCopy(slug, state, total, todayN, weekendN);

      lanes[slug] = {
        state,
        count: total,
        count_today: todayN,
        count_weekend: weekendN,
        copy,
      };
    }

    const payload = buildExploreHomePayload(portalSlug, { lanes });
    if (shouldCacheExploreHomePayload(payload)) {
      await setSharedCacheJson(
        EXPLORE_HOME_CACHE_NAMESPACE,
        cacheKey,
        payload,
        EXPLORE_HOME_CACHE_TTL_MS,
        { maxEntries: EXPLORE_HOME_CACHE_MAX_ENTRIES },
      );
      await setSharedCacheJson(
        EXPLORE_HOME_CACHE_NAMESPACE,
        `${portalSlug}|${EXPLORE_HOME_LATEST_CACHE_KEY_SUFFIX}`,
        payload,
        EXPLORE_HOME_LATEST_CACHE_TTL_MS,
        { maxEntries: EXPLORE_HOME_CACHE_MAX_ENTRIES },
      );
    }

    return payload;
  } catch (err) {
    console.error("[explore-home-data] getExploreHomeData error:", err);
    return null;
  }
}

export async function getCachedExploreHomeSeed(
  portalSlug: string,
): Promise<{ data: ExploreHomeResponse; isStale: boolean } | null> {
  const cacheKey = buildExploreHomeCacheKey(portalSlug, new Date());
  const exact = await getSharedCacheJson<ExploreHomeResponse>(
    EXPLORE_HOME_CACHE_NAMESPACE,
    cacheKey,
  );
  if (exact) {
    return {
      data: exact,
      isStale: false,
    };
  }

  const latest = await getSharedCacheJson<ExploreHomeResponse>(
    EXPLORE_HOME_CACHE_NAMESPACE,
    `${portalSlug}|${EXPLORE_HOME_LATEST_CACHE_KEY_SUFFIX}`,
  );
  if (latest) {
    return {
      data: latest,
      isStale: true,
    };
  }

  return null;
}
