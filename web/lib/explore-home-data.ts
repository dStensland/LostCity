/**
 * Server-side data fetcher for the Explore Home dashboard.
 *
 * Resolves the portal, then runs parallel Supabase count queries to build
 * lane metadata for all 8 lanes. Each lane gets:
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
import { getPortalBySlug } from "@/lib/portal";
import { getTimeSlot, isWeekend } from "@/lib/city-pulse/time-slots";
import { getLocalDateString, getLocalDateStringOffset } from "@/lib/formats";
import { getPortalSourceAccess } from "@/lib/federation";
import { buildPortalManifest } from "@/lib/portal-manifest";
import { applyManifestFederatedScopeToQuery } from "@/lib/portal-scope";
import type {
  ExploreHomeResponse,
  LanePreview,
  LaneSlug,
  LaneState,
} from "@/lib/types/explore-home";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Category IDs for the consolidated Shows lane */
const SHOW_CATEGORIES = ["film", "music", "theater", "comedy", "dance"];

/** Category ID for the Game Day lane */
const SPORTS_CATEGORY = "sports";

/** Weekend date range: Friday through Sunday (inclusive).
 *  On Fri→today through Sun. On Sat→yesterday Fri through tomorrow Sun.
 *  On Sun→Fri (2 days ago) through today. Mon-Thu→next Fri through next Sun. */
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
 *   - Time-of-day boost:         +0–2
 *
 * Score >= 3 → alive, score > 0 → quiet, 0 items → zero.
 *
 * Non-temporal lanes (todayCount === null && weekendCount === null):
 *   today/weekend are not applicable — alive when totalCount >= 3.
 */
function computeLaneState(
  totalCount: number,
  todayCount: number | null,
  weekendCount: number | null,
  timeSlotBoost: number,
): LaneState {
  // Only declare "zero" when ALL counts are empty. If totalCount is 0 but
  // today/weekend have items, the total count query likely failed — the lane
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
      case "calendar":
        return "No events on the calendar";
      case "map":
        return "No mappable events";
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
        case "calendar":
          return `${totalCount} events this week`;
        case "map":
          return `${totalCount} events on the map`;
        default:
          return `${todayCount} today`;
      }
    }
    // Alive but nothing specifically today — use weekend or total
    if ((weekendCount ?? 0) > 0) {
      return `${weekendCount} this weekend`;
    }
    return `${totalCount} upcoming`;
  }

  // Quiet state — informative nudge
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
    case "calendar":
      return `${totalCount} events on the calendar`;
    case "map":
      return `${totalCount} events near you`;
    default:
      return `${totalCount} available`;
  }
}

// ---------------------------------------------------------------------------
// Promise.allSettled helper
// ---------------------------------------------------------------------------

/** Unwrap a settled promise result, returning the fallback on rejection. */
function unwrapSettled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  if (result.status === "fulfilled") return result.value;
  console.warn("[explore-home-data] Query rejected:", result.reason);
  return fallback;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Fetch all Explore Home lane data for a portal.
 *
 * Returns null on fatal errors (portal not found, service client failure).
 * Individual lane failures degrade to zero state rather than failing the
 * entire response.
 */
export async function getExploreHomeData(
  portalSlug: string,
): Promise<ExploreHomeResponse | null> {
  try {
    // 1. Resolve portal + source access
    const portal = await getPortalBySlug(portalSlug);
    if (!portal) return null;

    const city =
      (portal.filters as { city?: string } | null)?.city || "Atlanta";

    const sourceAccess = await getPortalSourceAccess(portal.id);
    const manifest = buildPortalManifest({
      portalId: portal.id,
      slug: portal.slug,
      portalType: portal.portal_type,
      parentPortalId: portal.parent_portal_id,
      settings: portal.settings,
      filters: portal.filters as { city?: string; cities?: string[] } | null,
      sourceIds: sourceAccess.sourceIds,
    });

    const supabase = await createPortalScopedClient(portal.id);

    // Date boundaries — all time-of-day computation uses Eastern Time so
    // Vercel's UTC servers produce correct results for Atlanta.
    const now = new Date();
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

    // Base filters applied to all event queries (includes portal scoping)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function baseEventQuery(q: any) {
      const filtered = q
        .eq("is_active", true)
        .or("is_feed_ready.eq.true,is_feed_ready.is.null")
        .is("canonical_event_id", null)
        .gte("start_date", today)
        .lte("start_date", weekEnd);
      return applyManifestFederatedScopeToQuery(filtered, manifest, {
        publicOnlyWhenNoPortal: true,
        sourceIds: sourceAccess.sourceIds,
        sourceColumn: "source_id",
      });
    }

    // City filter for places
    const cityFilter = `${city}%`;

    // -----------------------------------------------------------------------
    // 2. Run all lane queries in parallel
    // -----------------------------------------------------------------------

    const countFallback = { count: null, error: null };

    const settled = await Promise.allSettled([
      // ----- Events lane (all events except shows and classes) -----
      // [0] total count
      baseEventQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
      )
        .not("category_id", "in", `(${SHOW_CATEGORIES.join(",")})`)
        .or("is_class.eq.false,is_class.is.null"),

      // [1] today count
      baseEventQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
      )
        .not("category_id", "in", `(${SHOW_CATEGORIES.join(",")})`)
        .or("is_class.eq.false,is_class.is.null")
        .eq("start_date", today),

      // [2] weekend count
      baseEventQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
      )
        .not("category_id", "in", `(${SHOW_CATEGORIES.join(",")})`)
        .or("is_class.eq.false,is_class.is.null")
        .gte("start_date", isCurrentlyWeekend ? today : weekend.start)
        .lte("start_date", weekend.end),

      // ----- Shows lane (film, music, theater, comedy, dance) -----
      // [3] total count
      baseEventQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
      )
        .in("category_id", SHOW_CATEGORIES)
        .or("is_class.eq.false,is_class.is.null"),

      // [4] today count
      baseEventQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
      )
        .in("category_id", SHOW_CATEGORIES)
        .or("is_class.eq.false,is_class.is.null")
        .eq("start_date", today),

      // [5] weekend count
      baseEventQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
      )
        .in("category_id", SHOW_CATEGORIES)
        .or("is_class.eq.false,is_class.is.null")
        .gte("start_date", isCurrentlyWeekend ? today : weekend.start)
        .lte("start_date", weekend.end),

      // ----- Game Day lane (sports events) -----
      // [6] total count
      baseEventQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
      )
        .eq("category_id", SPORTS_CATEGORY)
        .or("is_class.eq.false,is_class.is.null"),

      // [7] today count
      baseEventQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
      )
        .eq("category_id", SPORTS_CATEGORY)
        .or("is_class.eq.false,is_class.is.null")
        .eq("start_date", today),

      // [8] weekend count
      baseEventQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
      )
        .eq("category_id", SPORTS_CATEGORY)
        .or("is_class.eq.false,is_class.is.null")
        .gte("start_date", isCurrentlyWeekend ? today : weekend.start)
        .lte("start_date", weekend.end),

      // ----- Regulars lane (recurring events with series) -----
      // [9] total count
      applyManifestFederatedScopeToQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("is_regular_ready", true)
          .not("series_id", "is", null)
          .is("canonical_event_id", null)
          .not("is_class", "eq", true)
          .not("category_id", "in", "(film,theater,education,support,support_group,civic,volunteer,religious,community,family,learning)")
          .gte("start_date", today)
          .lte("start_date", weekEnd),
        manifest,
        { publicOnlyWhenNoPortal: true, sourceIds: sourceAccess.sourceIds, sourceColumn: "source_id" },
      ),

      // [10] today count
      applyManifestFederatedScopeToQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("is_regular_ready", true)
          .not("series_id", "is", null)
          .is("canonical_event_id", null)
          .not("is_class", "eq", true)
          .not("category_id", "in", "(film,theater,education,support,support_group,civic,volunteer,religious,community,family,learning)")
          .eq("start_date", today),
        manifest,
        { publicOnlyWhenNoPortal: true, sourceIds: sourceAccess.sourceIds, sourceColumn: "source_id" },
      ),

      // [11] weekend count
      applyManifestFederatedScopeToQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("is_regular_ready", true)
          .not("series_id", "is", null)
          .is("canonical_event_id", null)
          .not("is_class", "eq", true)
          .not("category_id", "in", "(film,theater,education,support,support_group,civic,volunteer,religious,community,family,learning)")
          .gte("start_date", isCurrentlyWeekend ? today : weekend.start)
          .lte("start_date", weekend.end),
        manifest,
        { publicOnlyWhenNoPortal: true, sourceIds: sourceAccess.sourceIds, sourceColumn: "source_id" },
      ),

      // ----- Places lane (count only) -----
      // [12] total count
      supabase
        .from("places")
        .select("id", { count: "exact", head: true })
        .neq("is_active", false)
        .ilike("city", cityFilter),

      // ----- Classes lane -----
      // [13] total count
      applyManifestFederatedScopeToQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("is_class", true)
          .eq("is_active", true)
          .or("is_feed_ready.eq.true,is_feed_ready.is.null")
          .is("canonical_event_id", null)
          .gte("start_date", today),
        manifest,
        { publicOnlyWhenNoPortal: true, sourceIds: sourceAccess.sourceIds, sourceColumn: "source_id" },
      ),

      // [14] today count
      applyManifestFederatedScopeToQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("is_class", true)
          .eq("is_active", true)
          .or("is_feed_ready.eq.true,is_feed_ready.is.null")
          .is("canonical_event_id", null)
          .eq("start_date", today),
        manifest,
        { publicOnlyWhenNoPortal: true, sourceIds: sourceAccess.sourceIds, sourceColumn: "source_id" },
      ),

      // [15] weekend count
      applyManifestFederatedScopeToQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("is_class", true)
          .eq("is_active", true)
          .or("is_feed_ready.eq.true,is_feed_ready.is.null")
          .is("canonical_event_id", null)
          .gte("start_date", isCurrentlyWeekend ? today : weekend.start)
          .lte("start_date", weekend.end),
        manifest,
        { publicOnlyWhenNoPortal: true, sourceIds: sourceAccess.sourceIds, sourceColumn: "source_id" },
      ),

      // ----- Calendar lane (total event count) -----
      // [16]
      baseEventQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
      ),

      // ----- Map lane (events with venue lat/lng) -----
      // [17]
      baseEventQuery(
        supabase
          .from("events")
          .select("id, venue:places!inner(lat, lng)", {
            count: "exact",
            head: true,
          })
      )
        .not("places.lat", "is", null)
        .not("places.lng", "is", null),
    ]);

    // Unwrap settled results — all queries are count-only now
    const results = settled.map((r) => unwrapSettled(r, countFallback));

    const [
      // Events lane [0-2]
      eventsCount, eventsTodayCount, eventsWeekendCount,
      // Shows lane [3-5]
      showsCount, showsTodayCount, showsWeekendCount,
      // Game Day lane [6-8]
      gameDayCount, gameDayTodayCount, gameDayWeekendCount,
      // Regulars lane [9-11]
      regularsCount, regularsTodayCount, regularsWeekendCount,
      // Places lane [12]
      placesCount,
      // Classes lane [13-15]
      classesCount, classesTodayCount, classesWeekendCount,
      // Calendar lane [16]
      calendarCount,
      // Map lane [17]
      mapCount,
    ] = results;

    // -----------------------------------------------------------------------
    // 3. Assemble lane data (counts + state + copy, no preview items)
    // -----------------------------------------------------------------------

    function buildLane(
      lane: LaneSlug,
      countResult: { count: number | null; error: unknown },
      todayResult: { count: number | null; error: unknown } | null,
      weekendResult: { count: number | null; error: unknown } | null,
    ): LanePreview {
      if (countResult.error) {
        console.warn(`[explore-home-data] Lane "${lane}" count query error:`, countResult.error);
      }
      const rawTotal = countResult.count ?? 0;

      if (todayResult?.error) {
        console.warn(`[explore-home-data] Lane "${lane}" count_today query error:`, todayResult.error);
      }
      const todayN = todayResult !== null ? (todayResult.count ?? 0) : null;

      if (weekendResult?.error) {
        console.warn(`[explore-home-data] Lane "${lane}" count_weekend query error:`, weekendResult.error);
      }
      const weekendN = weekendResult !== null ? (weekendResult.count ?? 0) : null;

      // If the total count query failed (returned 0/null) but today or weekend
      // succeeded, use the best available sub-count as the display total so
      // copy doesn't say "0 regulars".
      const total =
        rawTotal > 0
          ? rawTotal
          : Math.max(todayN ?? 0, weekendN ?? 0, rawTotal);

      const boost = getTimeBoostForLane(lane, currentHour);
      const state = computeLaneState(total, todayN, weekendN, boost);
      const copy = generateLaneCopy(lane, state, total, todayN, weekendN);

      // Log when total count appears degraded but sub-counts have data
      if (rawTotal === 0 && total > 0) {
        console.warn(
          `[explore-home-data] Lane "${lane}" total count is 0 but sub-counts have data (today=${todayN}, weekend=${weekendN}). Total count query may have failed.`,
        );
      }

      return { state, count: total, count_today: todayN, count_weekend: weekendN, copy };
    }

    const lanes: Record<LaneSlug, LanePreview> = {
      events: buildLane("events", eventsCount, eventsTodayCount, eventsWeekendCount),
      shows: buildLane("shows", showsCount, showsTodayCount, showsWeekendCount),
      "game-day": buildLane("game-day", gameDayCount, gameDayTodayCount, gameDayWeekendCount),
      regulars: buildLane("regulars", regularsCount, regularsTodayCount, regularsWeekendCount),
      places: buildLane("places", placesCount, null, null),
      classes: buildLane("classes", classesCount, classesTodayCount, classesWeekendCount),
      calendar: buildLane("calendar", calendarCount, null, null),
      map: buildLane("map", mapCount, null, null),
    };

    return { lanes };
  } catch (err) {
    console.error("[explore-home-data] getExploreHomeData error:", err);
    return null;
  }
}
