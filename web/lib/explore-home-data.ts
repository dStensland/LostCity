/**
 * Server-side data fetcher for the Explore Home dashboard.
 *
 * Resolves the portal, then runs parallel Supabase queries to build
 * lane preview data for all 9 lanes. Each lane gets:
 *   - count (total items)
 *   - count_today / count_weekend (for alive/quiet scoring)
 *   - up to 4 preview items
 *   - state: "alive" | "quiet" | "zero"
 *   - copy: human-readable summary
 *
 * Called by the API route (Task 3) which adds HTTP caching on top.
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
  PreviewItem,
} from "@/lib/types/explore-home";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max preview items per lane */
const PREVIEW_LIMIT = 4;

/** Category IDs that map to each vertical lane */
const FILM_CATEGORIES = ["film"];
const MUSIC_CATEGORIES = ["music"];
const STAGE_CATEGORIES = ["theater", "comedy", "dance"];

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
    case "live-music":
    case "stage":
      if (slot === "evening" || slot === "late_night") return 2;
      if (slot === "happy_hour") return 1;
      return 0;
    case "now-showing":
      if (slot === "midday" || slot === "happy_hour" || slot === "evening") return 1;
      return 0;
    case "events":
      if (slot === "evening") return 1;
      return 0;
    case "regulars":
      if (slot === "evening" || slot === "happy_hour") return 1;
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
      case "now-showing":
        return "No films showing right now";
      case "live-music":
        return "No live music scheduled";
      case "stage":
        return "No stage productions listed";
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
        case "now-showing":
          return `${todayCount} screening${todayCount === 1 ? "" : "s"} today`;
        case "live-music":
          return `${todayCount} show${todayCount === 1 ? "" : "s"} tonight`;
        case "stage":
          return `${todayCount} production${todayCount === 1 ? "" : "s"} tonight`;
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
    case "now-showing":
      return `${totalCount} film${totalCount === 1 ? "" : "s"} screening this week`;
    case "live-music":
      return `${totalCount} show${totalCount === 1 ? "" : "s"} this week — check back tonight`;
    case "stage":
      return `${totalCount} production${totalCount === 1 ? "" : "s"} running this week — tickets available`;
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
// Query helpers
// ---------------------------------------------------------------------------

interface EventPreviewRow {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  category_id: string | null;
  image_url: string | null;
  venue: { name: string; neighborhood: string | null } | null;
}

interface PlacePreviewRow {
  id: number;
  name: string;
  slug: string;
  place_type: string | null;
  neighborhood: string | null;
  image_url: string | null;
}

function eventToPreviewItem(
  row: EventPreviewRow,
  type: PreviewItem["type"],
  portalSlug: string,
): PreviewItem {
  const venueName = row.venue?.name ?? "";
  const neighborhood = row.venue?.neighborhood ?? "";
  const subtitle = [venueName, neighborhood].filter(Boolean).join(" · ");
  const timeStr = row.start_time
    ? formatTimeCompact(row.start_time)
    : "All day";
  const dateStr = row.start_date;

  return {
    id: row.id,
    type,
    title: row.title,
    subtitle,
    image_url: row.image_url,
    metadata: `${dateStr} · ${timeStr}`,
    detail_url: `/${portalSlug}/events/${row.id}`,
  };
}

function placeToPreviewItem(
  row: PlacePreviewRow,
  portalSlug: string,
): PreviewItem {
  const subtitle = [row.place_type, row.neighborhood]
    .filter(Boolean)
    .join(" · ");

  return {
    id: row.id,
    type: "place",
    title: row.name,
    subtitle,
    image_url: row.image_url,
    metadata: "",
    detail_url: `/${portalSlug}/places/${row.slug}`,
  };
}

/** Format "HH:MM:SS" → compact display like "7pm" or "7:30pm" */
function formatTimeCompact(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  if (m === 0) return `${hour12}${period}`;
  return `${hour12}:${m.toString().padStart(2, "0")}${period}`;
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

    // Time filter for today's preview queries: exclude events that ended more
    // than 1 hour ago. Applied only to today's date rows; future dates pass
    // through unconditionally. All-day events (null start_time) always pass.
    const minuteEt = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        minute: "numeric",
      }).format(now),
    );
    const secondEt = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        second: "numeric",
      }).format(now),
    );
    const graceHour = hourEt - 1;
    const gracePaddedHour = ((graceHour % 24) + 24) % 24; // handle midnight wrap
    const currentTimeMinusOneHour = `${String(gracePaddedHour).padStart(2, "0")}:${String(minuteEt).padStart(2, "0")}:${String(secondEt).padStart(2, "0")}`;
    // PostgREST or() filter: keep row if start_date is in the future, or
    // start_time is null (all-day), or start_time is on/after the grace cutoff.
    const upcomingOrFilter = `start_date.gt.${today},start_time.is.null,start_time.gte.${currentTimeMinusOneHour}`;

    // Shared select for event preview items
    const eventPreviewSelect = `
      id, title, start_date, start_time, category_id, image_url,
      venue:places(name, neighborhood)
    `;

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
    const dataFallback = { data: null, error: null };

    const settled = await Promise.allSettled([
      // ----- Events lane (all events except film and classes) -----
      baseEventQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
      )
        .not("category_id", "in", `(${FILM_CATEGORIES.join(",")})`)
        .or("is_class.eq.false,is_class.is.null"),

      baseEventQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
      )
        .not("category_id", "in", `(${FILM_CATEGORIES.join(",")})`)
        .or("is_class.eq.false,is_class.is.null")
        .eq("start_date", today),

      // Weekend count — if currently weekend, use today-Sun range; else Fri-Sun
      baseEventQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
      )
        .not("category_id", "in", `(${FILM_CATEGORIES.join(",")})`)
        .or("is_class.eq.false,is_class.is.null")
        .gte("start_date", isCurrentlyWeekend ? today : weekend.start)
        .lte("start_date", weekend.end),

      baseEventQuery(
        supabase
          .from("events")
          .select(eventPreviewSelect)
      )
        .not("category_id", "in", `(${FILM_CATEGORIES.join(",")})`)
        .or("is_class.eq.false,is_class.is.null")
        .or(upcomingOrFilter)
        .order("start_date", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: false })
        .order("data_quality", { ascending: false, nullsFirst: false })
        .order("image_url", { ascending: false, nullsFirst: false })
        .limit(PREVIEW_LIMIT),

      // ----- Now Showing (film) lane -----
      baseEventQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
      )
        .in("category_id", FILM_CATEGORIES),

      baseEventQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
      )
        .in("category_id", FILM_CATEGORIES)
        .eq("start_date", today),

      baseEventQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
      )
        .in("category_id", FILM_CATEGORIES)
        .gte("start_date", isCurrentlyWeekend ? today : weekend.start)
        .lte("start_date", weekend.end),

      baseEventQuery(
        supabase
          .from("events")
          .select(eventPreviewSelect)
      )
        .in("category_id", FILM_CATEGORIES)
        .or(upcomingOrFilter)
        .order("start_date", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: false })
        .order("data_quality", { ascending: false, nullsFirst: false })
        .order("image_url", { ascending: false, nullsFirst: false })
        .limit(PREVIEW_LIMIT),

      // ----- Live Music lane -----
      baseEventQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
      )
        .in("category_id", MUSIC_CATEGORIES),

      baseEventQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
      )
        .in("category_id", MUSIC_CATEGORIES)
        .eq("start_date", today),

      baseEventQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
      )
        .in("category_id", MUSIC_CATEGORIES)
        .gte("start_date", isCurrentlyWeekend ? today : weekend.start)
        .lte("start_date", weekend.end),

      baseEventQuery(
        supabase
          .from("events")
          .select(eventPreviewSelect)
      )
        .in("category_id", MUSIC_CATEGORIES)
        .or(upcomingOrFilter)
        .order("start_date", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: false })
        .order("data_quality", { ascending: false, nullsFirst: false })
        .order("image_url", { ascending: false, nullsFirst: false })
        .limit(PREVIEW_LIMIT),

      // ----- Stage lane (theater, comedy, dance) -----
      baseEventQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
      )
        .in("category_id", STAGE_CATEGORIES),

      baseEventQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
      )
        .in("category_id", STAGE_CATEGORIES)
        .eq("start_date", today),

      baseEventQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
      )
        .in("category_id", STAGE_CATEGORIES)
        .gte("start_date", isCurrentlyWeekend ? today : weekend.start)
        .lte("start_date", weekend.end),

      baseEventQuery(
        supabase
          .from("events")
          .select(eventPreviewSelect)
      )
        .in("category_id", STAGE_CATEGORIES)
        .or(upcomingOrFilter)
        .order("start_date", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: false })
        .order("data_quality", { ascending: false, nullsFirst: false })
        .order("image_url", { ascending: false, nullsFirst: false })
        .limit(PREVIEW_LIMIT),

      // ----- Regulars lane (recurring events with series) -----
      applyManifestFederatedScopeToQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .or("is_feed_ready.eq.true,is_feed_ready.is.null,is_regular_ready.eq.true")
          .not("series_id", "is", null)
          .is("canonical_event_id", null)
          .gte("start_date", today)
          .lte("start_date", weekEnd),
        manifest,
        { publicOnlyWhenNoPortal: true, sourceIds: sourceAccess.sourceIds, sourceColumn: "source_id" },
      ),

      applyManifestFederatedScopeToQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .or("is_feed_ready.eq.true,is_feed_ready.is.null,is_regular_ready.eq.true")
          .not("series_id", "is", null)
          .is("canonical_event_id", null)
          .eq("start_date", today),
        manifest,
        { publicOnlyWhenNoPortal: true, sourceIds: sourceAccess.sourceIds, sourceColumn: "source_id" },
      ),

      applyManifestFederatedScopeToQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .or("is_feed_ready.eq.true,is_feed_ready.is.null,is_regular_ready.eq.true")
          .not("series_id", "is", null)
          .is("canonical_event_id", null)
          .gte("start_date", isCurrentlyWeekend ? today : weekend.start)
          .lte("start_date", weekend.end),
        manifest,
        { publicOnlyWhenNoPortal: true, sourceIds: sourceAccess.sourceIds, sourceColumn: "source_id" },
      ),

      applyManifestFederatedScopeToQuery(
        supabase
          .from("events")
          .select(eventPreviewSelect)
          .eq("is_active", true)
          .or("is_feed_ready.eq.true,is_feed_ready.is.null,is_regular_ready.eq.true")
          .not("series_id", "is", null)
          .is("canonical_event_id", null)
          .gte("start_date", today)
          .lte("start_date", weekEnd)
          .or(upcomingOrFilter)
          .order("start_date", { ascending: true })
          .order("start_time", { ascending: true, nullsFirst: false })
          .order("image_url", { ascending: false, nullsFirst: false })
          .limit(PREVIEW_LIMIT),
        manifest,
        { publicOnlyWhenNoPortal: true, sourceIds: sourceAccess.sourceIds, sourceColumn: "source_id" },
      ),

      // ----- Places lane (count + preview) -----
      supabase
        .from("places")
        .select("id", { count: "exact", head: true })
        .neq("is_active", false)
        .ilike("city", cityFilter),

      supabase
        .from("places")
        .select("id, name, slug, place_type, neighborhood, image_url")
        .neq("is_active", false)
        .ilike("city", cityFilter)
        .not("image_url", "is", null)
        .order("data_quality", { ascending: false, nullsFirst: false })
        .limit(PREVIEW_LIMIT),

      // ----- Classes lane -----
      applyManifestFederatedScopeToQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("is_class", true)
          .eq("is_active", true)
          .is("canonical_event_id", null)
          .gte("start_date", today),
        manifest,
        { publicOnlyWhenNoPortal: true, sourceIds: sourceAccess.sourceIds, sourceColumn: "source_id" },
      ),

      applyManifestFederatedScopeToQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("is_class", true)
          .eq("is_active", true)
          .is("canonical_event_id", null)
          .eq("start_date", today),
        manifest,
        { publicOnlyWhenNoPortal: true, sourceIds: sourceAccess.sourceIds, sourceColumn: "source_id" },
      ),

      applyManifestFederatedScopeToQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("is_class", true)
          .eq("is_active", true)
          .is("canonical_event_id", null)
          .gte("start_date", isCurrentlyWeekend ? today : weekend.start)
          .lte("start_date", weekend.end),
        manifest,
        { publicOnlyWhenNoPortal: true, sourceIds: sourceAccess.sourceIds, sourceColumn: "source_id" },
      ),

      applyManifestFederatedScopeToQuery(
        supabase
          .from("events")
          .select(eventPreviewSelect)
          .eq("is_class", true)
          .eq("is_active", true)
          .is("canonical_event_id", null)
          .gte("start_date", today)
          .order("image_url", { ascending: false, nullsFirst: false })
          .order("start_date", { ascending: true })
          .limit(PREVIEW_LIMIT),
        manifest,
        { publicOnlyWhenNoPortal: true, sourceIds: sourceAccess.sourceIds, sourceColumn: "source_id" },
      ),

      // ----- Calendar lane (total event count, no previews) -----
      baseEventQuery(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
      ),

      // ----- Map lane (events with venue lat/lng) -----
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

    // Unwrap settled results — rejected queries degrade to zero state
    const [
      // Events lane
      eventsCount,
      eventsTodayCount,
      eventsWeekendCount,
      eventsPreview,

      // Now Showing (film) lane
      filmCount,
      filmTodayCount,
      filmWeekendCount,
      filmPreview,

      // Live Music lane
      musicCount,
      musicTodayCount,
      musicWeekendCount,
      musicPreview,

      // Stage lane
      stageCount,
      stageTodayCount,
      stageWeekendCount,
      stagePreview,

      // Regulars lane
      regularsCount,
      regularsTodayCount,
      regularsWeekendCount,
      regularsPreview,

      // Places lane
      placesCount,
      placesPreview,

      // Classes lane
      classesCount,
      classesTodayCount,
      classesWeekendCount,
      classesPreview,

      // Calendar lane
      calendarCount,

      // Map lane
      mapCount,
    ] = settled.map((r, i) => {
      // Indices 3,7,11,15,19,21,25 are data (preview) queries; rest are count queries
      const isDataQuery = [3, 7, 11, 15, 19, 21, 25].includes(i);
      return unwrapSettled(r, isDataQuery ? dataFallback : countFallback);
    });

    // -----------------------------------------------------------------------
    // 3. Assemble lane previews
    // -----------------------------------------------------------------------

    function buildLane(
      lane: LaneSlug,
      countResult: { count: number | null; error: unknown },
      todayResult: { count: number | null; error: unknown } | null,
      weekendResult: { count: number | null; error: unknown } | null,
      previewResult: { data: unknown[] | null; error: unknown } | null,
      mapItems: (rows: unknown[]) => PreviewItem[],
    ): LanePreview {
      const rawTotal = countResult.count ?? 0;
      const todayN = todayResult !== null ? (todayResult.count ?? 0) : null;
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
      const items = previewResult?.data ? mapItems(previewResult.data) : [];

      // Log when total count appears degraded but sub-counts have data
      if (rawTotal === 0 && total > 0) {
        console.warn(
          `[explore-home-data] Lane "${lane}" total count is 0 but sub-counts have data (today=${todayN}, weekend=${weekendN}). Total count query may have failed.`,
        );
      }

      return {
        state,
        count: total,
        count_today: todayN,
        count_weekend: weekendN,
        copy,
        items,
      };
    }

    const mapEventItems = (rows: unknown[]) =>
      (rows as EventPreviewRow[]).map((r) =>
        eventToPreviewItem(r, "event", portalSlug),
      );

    const mapShowtimeItems = (rows: unknown[]) =>
      (rows as EventPreviewRow[]).map((r) =>
        eventToPreviewItem(r, "showtime", portalSlug),
      );

    const mapRegularItems = (rows: unknown[]) =>
      (rows as EventPreviewRow[]).map((r) =>
        eventToPreviewItem(r, "regular", portalSlug),
      );

    const mapPlaceItems = (rows: unknown[]) =>
      (rows as PlacePreviewRow[]).map((r) =>
        placeToPreviewItem(r, portalSlug),
      );

    const lanes: Record<LaneSlug, LanePreview> = {
      events: buildLane(
        "events",
        eventsCount,
        eventsTodayCount,
        eventsWeekendCount,
        eventsPreview,
        mapEventItems,
      ),
      "now-showing": buildLane(
        "now-showing",
        filmCount,
        filmTodayCount,
        filmWeekendCount,
        filmPreview,
        mapShowtimeItems,
      ),
      "live-music": buildLane(
        "live-music",
        musicCount,
        musicTodayCount,
        musicWeekendCount,
        musicPreview,
        mapEventItems,
      ),
      stage: buildLane(
        "stage",
        stageCount,
        stageTodayCount,
        stageWeekendCount,
        stagePreview,
        mapEventItems,
      ),
      regulars: buildLane(
        "regulars",
        regularsCount,
        regularsTodayCount,
        regularsWeekendCount,
        regularsPreview,
        mapRegularItems,
      ),
      places: buildLane(
        "places",
        placesCount,
        null,
        null,
        placesPreview,
        mapPlaceItems,
      ),
      classes: buildLane(
        "classes",
        classesCount,
        classesTodayCount,
        classesWeekendCount,
        classesPreview,
        mapEventItems,
      ),
      calendar: buildLane(
        "calendar",
        calendarCount,
        null,
        null,
        null,
        () => [],
      ),
      map: buildLane(
        "map",
        mapCount,
        null,
        null,
        null,
        () => [],
      ),
    };

    return { lanes };
  } catch (err) {
    console.error("[explore-home-data] getExploreHomeData error:", err);
    return null;
  }
}
