/**
 * GET /api/portals/[slug]/city-pulse
 *
 * Unified City Pulse feed endpoint. Returns mixed content types
 * (events, destinations, specials) with context awareness.
 * Auth is optional — anonymous gets base feed, authenticated gets
 * personalization layer.
 *
 * Architecture: thin orchestrator over the pipeline in lib/city-pulse/pipeline/.
 * Each pipeline stage is independently testable and modifiable without
 * touching this file.
 */

import { createClient, createPortalScopedClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api-utils";
import {
  normalizePortalSlug,
  resolvePortalSlugAlias,
} from "@/lib/portal-aliases";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";
import { resolveHeader } from "@/lib/city-pulse/header-resolver";
import { getTimeSlot } from "@/lib/city-pulse/time-slots";
import { getLocalDateString } from "@/lib/formats";
import { buildTabEventPool } from "@/lib/city-pulse/section-builders";
import { fetchSocialProofCounts } from "@/lib/social-proof";
import { buildFriendsGoingMap } from "@/lib/city-pulse/counts";
import { loadUserSignals } from "@/lib/city-pulse/user-signals";
import {
  resolvePortalContext,
  fetchEventPools,
  fetchFeedCounts,
  fetchPhaseAEnrichments,
  fetchPhaseBEnrichments,
  buildSections,
  assembleResponse,
  buildAllWindowCategoryCounts,
  buildCountCategoryQuery,
  fetchTabEventPool,
} from "@/lib/city-pulse/pipeline";
import { isSceneEvent } from "@/lib/city-pulse/section-builders";
import type {
  CityPulseResponse,
  TimeSlot,
} from "@/lib/city-pulse/types";

// ---------------------------------------------------------------------------
// Cache configuration
// ---------------------------------------------------------------------------

const CACHE_NAMESPACE = "api:city-pulse";
const ANON_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const AUTH_CACHE_TTL_MS = 60 * 1000; // 1 min
const CACHE_MAX_ENTRIES = 200;

const ANON_CACHE_CONTROL =
  "public, s-maxage=300, stale-while-revalidate=3600";
const AUTH_CACHE_CONTROL =
  "private, max-age=60, stale-while-revalidate=120";

export const revalidate = 300;

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

type Props = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  const requestSlug = normalizePortalSlug(slug);
  const canonicalSlug = resolvePortalSlugAlias(requestSlug);
  const { searchParams } = new URL(request.url);
  const timeSlotOverride = searchParams.get("time_slot") as TimeSlot | null;
  const dayOverride = searchParams.get("day") as string | null;
  const requestedTab = searchParams.get("tab") as "this_week" | "coming_up" | null;
  const interestsParam = searchParams.get("interests");

  const now = new Date();

  // Compute portal-local time context needed for the cache key.
  // Mirrors the logic in resolvePortalContext so the cache key is stable.
  const portalHourForCache = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  const timeSlotForCache = timeSlotOverride ?? getTimeSlot(portalHourForCache);
  const effectiveNowForCache = new Date(now);
  if (timeSlotForCache === "late_night" && portalHourForCache < 5) {
    effectiveNowForCache.setDate(effectiveNowForCache.getDate() - 1);
  }
  const todayForCache = getLocalDateString(effectiveNowForCache);

  // ---------------------------------------------------------------------------
  // Auth check (optional)
  // ---------------------------------------------------------------------------

  const supabase = await createClient();
  let userId: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // Anonymous is fine
  }

  const isAuthenticated = !!userId;

  // ---------------------------------------------------------------------------
  // Cache check (skip when admin overrides are active)
  // ---------------------------------------------------------------------------

  const hasAdminOverrides = !!(timeSlotOverride || dayOverride);

  // Auth cache key uses 5-minute precision (same as anon TTL) — the only
  // personalized data is social proof counts which are cheap to recompute.
  const cacheKey = isAuthenticated
    ? `${userId}|${canonicalSlug}|${Math.floor(now.getTime() / 300000)}`
    : `${canonicalSlug}|${timeSlotForCache}|${todayForCache}`;

  if (!hasAdminOverrides && !requestedTab) {
    const cached = await getSharedCacheJson<CityPulseResponse>(
      CACHE_NAMESPACE,
      cacheKey,
    );
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": isAuthenticated
            ? AUTH_CACHE_CONTROL
            : ANON_CACHE_CONTROL,
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Stage 1: Resolve portal context
  // ---------------------------------------------------------------------------

  const portalResult = await resolvePortalContext(canonicalSlug, supabase, {
    timeSlotOverride,
    dayOverride,
    requestedTab,
    interestsParam,
    userId,
  });

  if ("notFound" in portalResult) {
    return errorResponse("Portal not found", "city-pulse", 404);
  }

  const { context: ctx } = portalResult;
  const portalClient = await createPortalScopedClient(ctx.portalData.id);

  // ---------------------------------------------------------------------------
  // Tab-only mode: ?tab=this_week or ?tab=coming_up
  // Returns just the requested tab's events + fresh counts
  // ---------------------------------------------------------------------------

  if (requestedTab) {
    const [tabStart, tabEnd] =
      requestedTab === "this_week"
        ? [ctx.tomorrow, ctx.weekAhead]
        : [ctx.weekAhead, ctx.fourWeeksAhead];

    const tabCountQuery = buildCountCategoryQuery(portalClient, ctx, tabStart, tabEnd);
    const todayCountQuery = buildCountCategoryQuery(portalClient, ctx, ctx.today, ctx.today);

    const [tabEvents, tabCountResult, todayCountResult, tabUserSignals] =
      await Promise.all([
        fetchTabEventPool(portalClient, ctx, tabStart, tabEnd),
        tabCountQuery,
        todayCountQuery,
        // User signals needed for friend RSVPs in the tab pool
        loadUserSignals(supabase, userId, ctx.portalData.id),
      ]);

    // Social proof for tab events
    const tabEventIds = tabEvents.map((e) => e.id);
    const tabSocialCounts = await fetchSocialProofCounts(tabEventIds);
    const tabEventsWithProof = tabEvents.map((e) => {
      const counts = tabSocialCounts.get(e.id);
      return counts
        ? { ...e, going_count: counts.going || 0, interested_count: counts.interested || 0 }
        : e;
    });

    // Friend RSVPs for tab events
    const tabFriendsGoingMap = await buildFriendsGoingMap(
      supabase,
      tabEventIds,
      tabUserSignals?.friendIds ?? [],
    );

    const tabPoolSection = buildTabEventPool(
      requestedTab as "this_week" | "coming_up",
      tabEventsWithProof,
      tabUserSignals,
      tabFriendsGoingMap,
    );

    // Tab badge counts — use same exclusion logic as the original route:
    // scene events and generic recurring without premium tags are excluded.
    type TabCountRow = {
      title: string | null;
      category_id: string | null;
      series_id: string | null;
      is_recurring: boolean | null;
      genres: string[] | null;
      tags: string[] | null;
    };
    const LINEUP_PREMIUM_TAGS = new Set(["touring", "album-release", "one-night-only"]);
    const excludeNonLineupRecurring = (rows: TabCountRow[]): TabCountRow[] =>
      rows.filter((row) => {
        if (!row.series_id && !row.is_recurring) return true;
        const pseudo = {
          id: 0, title: row.title ?? "", start_date: "", start_time: null,
          is_all_day: false, is_free: false, price_min: null, price_max: null,
          image_url: null, description: null,
          venue: { id: 0, name: "", slug: "", neighborhood: null },
          category: row.category_id, series_id: row.series_id,
          is_recurring: row.is_recurring, genres: row.genres, tags: row.tags,
        };
        if (isSceneEvent(pseudo as never)) return false;
        const tags = row.tags ?? [];
        if (!tags.some((t) => LINEUP_PREMIUM_TAGS.has(t))) return false;
        return true;
      });
    const dedupeTabCountRows = (rows: TabCountRow[]): TabCountRow[] => {
      const seen = new Set<string>();
      const result: TabCountRow[] = [];
      for (const row of rows) {
        if (row.series_id) {
          if (seen.has(row.series_id)) continue;
          seen.add(row.series_id);
        }
        result.push(row);
      }
      return result;
    };

    const todayRows = (todayCountResult.data || []) as unknown as TabCountRow[];
    const tabRows = (tabCountResult.data || []) as unknown as TabCountRow[];
    const isWeekTab = requestedTab === "this_week";
    // Build per-category counts from the tab rows (mirrors original route logic)
    const buildTabCategoryCounts = (rows: TabCountRow[]): Record<string, number> => {
      const deduped = dedupeTabCountRows(excludeNonLineupRecurring(rows));
      const counts: Record<string, number> = {};
      for (const row of deduped) {
        if (row.category_id) {
          counts[row.category_id] = (counts[row.category_id] || 0) + 1;
        }
        if (Array.isArray(row.genres)) {
          for (const g of row.genres) {
            counts[`genre:${g}`] = (counts[`genre:${g}`] || 0) + 1;
          }
        }
        if (Array.isArray(row.tags)) {
          for (const t of row.tags) {
            counts[`tag:${t}`] = (counts[`tag:${t}`] || 0) + 1;
          }
        }
      }
      return counts;
    };

    const tabCountsObj = {
      today: dedupeTabCountRows(excludeNonLineupRecurring(todayRows)).length,
      this_week: isWeekTab ? dedupeTabCountRows(excludeNonLineupRecurring(tabRows)).length : 0,
      coming_up: isWeekTab ? 0 : dedupeTabCountRows(excludeNonLineupRecurring(tabRows)).length,
    };

    const tabResponse: CityPulseResponse = {
      portal: { slug: canonicalSlug, name: ctx.portalData.name },
      context: ctx.feedContext,
      header: {} as CityPulseResponse["header"],
      sections: [tabPoolSection].filter(Boolean) as import("@/lib/city-pulse/types").CityPulseSection[],
      curated_sections: [],
      personalization: {
        level: !userId ? "anonymous" : "logged_in",
        applied: false,
      },
      events_pulse: { total_active: 0, trending_event: null },
      tab_counts: tabCountsObj,
      category_counts: {
        today: buildTabCategoryCounts(todayRows),
        this_week: isWeekTab ? buildTabCategoryCounts(tabRows) : {},
        coming_up: isWeekTab ? {} : buildTabCategoryCounts(tabRows),
      },
    };

    return NextResponse.json(tabResponse, {
      headers: {
        "Cache-Control": hasAdminOverrides
          ? "no-store"
          : isAuthenticated
            ? AUTH_CACHE_CONTROL
            : ANON_CACHE_CONTROL,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Full load mode — stages 2–6 run in parallel where possible
  // ---------------------------------------------------------------------------

  // Stage 2 (events) + Stage 3 (counts) + Stage 4A (enrichments) — all parallel
  const [pools, counts, phaseA] = await Promise.all([
    fetchEventPools(portalClient, ctx),
    fetchFeedCounts(supabase, ctx),
    fetchPhaseAEnrichments(supabase, ctx),
  ]);

  // Stage 4B: social proof + friends + new-from-spots — depends on event IDs + userSignals
  const allEvents = [...pools.todayEvents, ...pools.trendingEvents];
  const allEventIds = Array.from(new Set(allEvents.map((e) => e.id)));

  const phaseB = await fetchPhaseBEnrichments(
    supabase,
    portalClient,
    ctx,
    allEventIds,
    phaseA.userSignals,
  );

  // Stage 5: Section assembly
  const allEventCategoryCounts = buildAllWindowCategoryCounts(counts.precomputedRows);

  const { sections, curatedSections, personalizationLevel, trendingEventsWithProof } =
    buildSections(ctx, pools, phaseA, phaseB, allEventCategoryCounts, counts.venueTypeCounts);

  // Resolve feed header (CMS override layer)
  const topTrendingEvent = trendingEventsWithProof.length > 0
    ? trendingEventsWithProof[0].title
    : null;

  const eventsPulse = {
    total_active: pools.todayEvents.length,
    trending_event: topTrendingEvent,
  };

  const resolvedHeader = await resolveHeader({
    candidates: phaseA.headerCandidates,
    context: ctx.feedContext,
    portalSlug: canonicalSlug,
    portalId: ctx.portalData.id,
    portalName: ctx.portalData.name,
    eventsPulse,
    now,
    user: phaseA.userProfile,
    supabase,
    portalCity: ctx.portalCity,
  });

  // Stage 6: Final response assembly
  const response = assembleResponse(
    ctx,
    sections,
    curatedSections,
    resolvedHeader,
    eventsPulse,
    counts,
    personalizationLevel,
  );

  // ---------------------------------------------------------------------------
  // Cache + return
  // ---------------------------------------------------------------------------

  if (!hasAdminOverrides && !requestedTab) {
    await setSharedCacheJson(
      CACHE_NAMESPACE,
      cacheKey,
      response,
      isAuthenticated ? AUTH_CACHE_TTL_MS : ANON_CACHE_TTL_MS,
      { maxEntries: CACHE_MAX_ENTRIES },
    );
  }

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": hasAdminOverrides
        ? "no-store"
        : isAuthenticated
          ? AUTH_CACHE_CONTROL
          : ANON_CACHE_CONTROL,
    },
  });
}
