/**
 * Pipeline stage 1: Portal resolution.
 *
 * Looks up the portal record, resolves federation source access, builds the
 * portal manifest, and computes time/date context. Returns the "pipeline
 * context" object that every subsequent stage receives.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TimeSlot } from "@/lib/city-pulse/types";
import { getPortalSourceAccess } from "@/lib/federation";
import { buildPortalManifest } from "@/lib/portal-manifest";
import { applyManifestFederatedScopeToQuery } from "@/lib/portal-scope";
import { buildFeedContext } from "@/lib/city-pulse/context";
import { getTimeSlot } from "@/lib/city-pulse/time-slots";
import { getLocalDateString } from "@/lib/formats";
import { addDays } from "date-fns";
import {
  ALL_INTEREST_IDS,
  DEFAULT_INTEREST_IDS,
} from "@/lib/city-pulse/interests";
import { getCivicQuickLinks } from "@/lib/city-pulse/quick-links";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

export type PortalData = {
  id: string;
  slug: string;
  name: string;
  portal_type: string;
  parent_portal_id?: string | null;
  settings: Record<string, unknown> | null;
  filters?: Record<string, unknown> | string | null;
};

export type PortalFilters = {
  city?: string;
  cities?: string[];
  geo_center?: [number, number];
  geo_radius_km?: number;
};

// ---------------------------------------------------------------------------
// Pipeline context — passed to every downstream stage
// ---------------------------------------------------------------------------

export type PipelineContext = {
  // Portal identity
  portalData: PortalData;
  canonicalSlug: string;
  portalFilters: PortalFilters;
  portalCity: string | undefined;
  geoCenter: [number, number] | undefined;

  // Auth
  userId: string | null;
  isAuthenticated: boolean;

  // Time / date
  now: Date;
  today: string;
  tomorrow: string;
  weekAhead: string;
  twoWeeksAhead: string;
  fourWeeksAhead: string;
  horizonStart: string;
  horizonEnd: string;
  timeSlot: TimeSlot;
  portalDay: string;
  portalHour: number;

  // Interests chips (for per-category event fetching)
  requestedInterests: string[];

  // Feed context (weather, holidays, etc.)
  feedContext: Awaited<ReturnType<typeof buildFeedContext>>;

  // Federation
  manifest: ReturnType<typeof buildPortalManifest>;
  hasSubscribedSources: boolean;

  // Scoping helper — applies portal scope to any Supabase query
  applyPortalScope: <T>(query: T) => T;

  // Admin override flags
  hasAdminOverrides: boolean;
  requestedTab: "this_week" | "coming_up" | null;
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function parsePortalFilters(
  raw: Record<string, unknown> | string | null | undefined,
): PortalFilters {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw as PortalFilters;
}

// ---------------------------------------------------------------------------
// Stage function
// ---------------------------------------------------------------------------

/**
 * Resolves portal context from the incoming request parameters.
 *
 * Performs the portal DB lookup, resolves federation source access, builds the
 * portal manifest, computes time/date state, and returns a self-contained
 * context object for the rest of the pipeline.
 *
 * @param canonicalSlug  Already-normalized portal slug
 * @param supabase       Server Supabase client (anon key, user session)
 * @param portalClient   Portal-scoped Supabase client (from createPortalScopedClient)
 * @param opts           Request-level options parsed from URL params
 */
export async function resolvePortalContext(
  canonicalSlug: string,
  supabase: SupabaseClient,
  opts: {
    timeSlotOverride: TimeSlot | null;
    dayOverride: string | null;
    requestedTab: "this_week" | "coming_up" | null;
    interestsParam: string | null;
    userId: string | null;
  },
): Promise<{ context: PipelineContext; portalData: PortalData } | { notFound: true }> {
  // Portal lookup
  let portalResult = await supabase
    .from("portals")
    .select("id, slug, name, portal_type, parent_portal_id, settings, filters")
    .eq("slug", canonicalSlug)
    .eq("status", "active")
    .maybeSingle();

  if (portalResult.error && portalResult.error.message?.includes("column")) {
    portalResult = await supabase
      .from("portals")
      .select("id, slug, name, portal_type, settings")
      .eq("slug", canonicalSlug)
      .eq("status", "active")
      .maybeSingle();
  }

  const portalData = portalResult.data as PortalData | null;
  if (!portalData) {
    return { notFound: true };
  }

  const portalFilters = parsePortalFilters(portalData.filters);
  const portalCity = portalFilters.city;
  const geoCenter = portalFilters.geo_center;

  // Time / date computation
  const now = new Date();
  const portalHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  const portalDayDate = portalHour < 5 ? new Date(now.getTime() - 86400000) : now;
  const portalDay = opts.dayOverride ??
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "long",
    })
      .format(portalDayDate)
      .toLowerCase();
  const timeSlot = opts.timeSlotOverride ?? getTimeSlot(portalHour);

  const effectiveNow = new Date(now);
  if (timeSlot === "late_night" && portalHour < 5) {
    effectiveNow.setDate(effectiveNow.getDate() - 1);
  }
  const today = getLocalDateString(effectiveNow);
  const tomorrow = getLocalDateString(addDays(effectiveNow, 1));
  const weekAhead = getLocalDateString(addDays(effectiveNow, 7));
  const twoWeeksAhead = getLocalDateString(addDays(effectiveNow, 14));
  const fourWeeksAhead = getLocalDateString(addDays(effectiveNow, 28));
  const horizonStart = getLocalDateString(addDays(effectiveNow, 7));
  const horizonEnd = getLocalDateString(addDays(effectiveNow, 180));

  // Federation + manifest (parallel — independent)
  const [federationAccess, feedContext] = await Promise.all([
    getPortalSourceAccess(portalData.id),
    buildFeedContext({
      portalId: portalData.id,
      portalSlug: canonicalSlug,
      portalLat: geoCenter?.[0],
      portalLng: geoCenter?.[1],
      timeSlotOverride: timeSlot,
      dayOverride: portalDay,
      now,
    }),
  ]);

  const hasSubscribedSources =
    federationAccess.sourceIds && federationAccess.sourceIds.length > 0;

  const manifest = buildPortalManifest({
    portalId: portalData.id,
    slug: canonicalSlug,
    portalType: portalData.portal_type,
    parentPortalId: portalData.parent_portal_id,
    settings: portalData.settings,
    filters: portalFilters as { city?: string; cities?: string[] },
    sourceIds: hasSubscribedSources ? federationAccess.sourceIds : [],
  });

  const applyPortalScope = <T>(query: T): T =>
    applyManifestFederatedScopeToQuery(query, manifest, {
      sourceIds: hasSubscribedSources ? federationAccess.sourceIds : [],
      publicOnlyWhenNoPortal: true,
    });

  // Interest chips
  const requestedInterests = opts.interestsParam
    ? opts.interestsParam.split(",").filter((id) => ALL_INTEREST_IDS.includes(id))
    : [...DEFAULT_INTEREST_IDS];

  // Apply content policy: replace quick links for civic portals
  const effectiveFeedContext =
    manifest.contentPolicy.quickLinkMode === "civic"
      ? { ...feedContext, quick_links: getCivicQuickLinks(canonicalSlug) }
      : feedContext;

  const context: PipelineContext = {
    portalData,
    canonicalSlug,
    portalFilters,
    portalCity,
    geoCenter,
    userId: opts.userId,
    isAuthenticated: !!opts.userId,
    now,
    today,
    tomorrow,
    weekAhead,
    twoWeeksAhead,
    fourWeeksAhead,
    horizonStart,
    horizonEnd,
    timeSlot,
    portalDay,
    portalHour,
    requestedInterests,
    feedContext: effectiveFeedContext,
    manifest,
    hasSubscribedSources,
    applyPortalScope,
    hasAdminOverrides: !!(opts.timeSlotOverride || opts.dayOverride),
    requestedTab: opts.requestedTab,
  };

  return { context, portalData };
}
