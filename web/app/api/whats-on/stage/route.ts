import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { getLocalDateString } from "@/lib/formats";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";
import { applyFeedGate } from "@/lib/feed-gate";
import { resolvePortalQueryContext, getVerticalFromRequest } from "@/lib/portal-query-context";
import { applyFederatedPortalScopeToQuery } from "@/lib/portal-scope";
import { getPortalSourceAccess } from "@/lib/federation";

// ISR: revalidate every 5 minutes
export const revalidate = 300;

const STAGE_CACHE_NAMESPACE = "api:whats-on:stage";
const STAGE_CACHE_TTL_MS = 3 * 60 * 1000;
const STAGE_CACHE_MAX_ENTRIES = 90;
const STAGE_EVENT_LIMIT = 200;
const STAGE_META_DATE_LIMIT = 1000;
const STAGE_META_LOOKAHEAD_DAYS = 30;

const STAGE_CATEGORIES = ["comedy", "theater"] as const;
type StageCategory = (typeof STAGE_CATEGORIES)[number];

function isStageCategory(value: string | null): value is StageCategory {
  return STAGE_CATEGORIES.includes(value as StageCategory);
}

function addDaysToDateString(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setDate(parsed.getDate() + days);
  return getLocalDateString(parsed);
}

type StageVenue = {
  id: number;
  name: string;
  slug: string;
  neighborhood: string | null;
  city: string | null;
  image_url: string | null;
  lat: number | null;
  lng: number | null;
};

type StageSeries = {
  id: string;
  slug: string;
  title: string;
};

type StageEvent = {
  id: number;
  title: string;
  start_time: string | null;
  start_date: string;
  end_date: string | null;
  is_free: boolean | null;
  tags: string[] | null;
  genres: string[] | null;
  category_id: string | null;
  age_policy: string | null;
  series_id: string | null;
  venue: StageVenue | null;
  series: StageSeries | null;
};

type StageShow = {
  event_id: number;
  title: string;
  start_time: string | null;
  start_date: string;
  end_date: string | null;
  is_free: boolean;
  tags: string[];
  genres: string[];
  category_id: string;
  age_policy: string | null;
  series_id: string | null;
  series_slug: string | null;
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    image_url: string | null;
    lat: number | null;
    lng: number | null;
  };
};

function toShow(event: StageEvent): StageShow {
  return {
    event_id: event.id,
    title: event.title,
    start_time: event.start_time,
    start_date: event.start_date,
    end_date: event.end_date,
    is_free: event.is_free ?? false,
    tags: event.tags ?? [],
    genres: event.genres ?? [],
    category_id: event.category_id ?? "theater",
    age_policy: event.age_policy,
    series_id: event.series_id,
    series_slug: event.series?.slug ?? null,
    venue: {
      id: event.venue!.id,
      name: event.venue!.name,
      slug: event.venue!.slug,
      neighborhood: event.venue!.neighborhood,
      image_url: event.venue!.image_url,
      lat: event.venue!.lat,
      lng: event.venue!.lng,
    },
  };
}

/** Check if a venue is in the portal's city scope */
function isVenueInScope(venue: StageVenue | null, portalCity: string): boolean {
  if (!venue) return false;
  if (!venue.city) return false; // null city = unknown = exclude from city-scoped results
  return venue.city.toLowerCase() === portalCity.toLowerCase();
}

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const date = searchParams.get("date") || getLocalDateString(new Date());
  const includeMeta = searchParams.get("meta") === "true";
  const filterParam = searchParams.get("filter");
  const categoryFilter: StageCategory | null = isStageCategory(filterParam)
    ? filterParam
    : null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Invalid date format. Use YYYY-MM-DD." },
      { status: 400 },
    );
  }

  // Resolve portal context for city + portal_id scoping
  const portalContext = await resolvePortalQueryContext(supabase, searchParams, getVerticalFromRequest(request));
  const portalCity = portalContext.filters.city || "Atlanta";
  const portalId = portalContext.portalId;
  const sourceAccess = portalId ? await getPortalSourceAccess(portalId) : null;

  const cacheKey = [date, includeMeta ? "1" : "0", portalCity, portalId ?? "none", categoryFilter ?? "all"].join("|");

  const result = await getOrSetSharedCacheJson<Record<string, unknown>>(
    STAGE_CACHE_NAMESPACE,
    cacheKey,
    STAGE_CACHE_TTL_MS,
    async () => {
      let stageQuery = supabase
        .from("events")
        .select(
          `
          id,
          title,
          start_time,
          start_date,
          end_date,
          is_free,
          tags,
          genres,
          category_id,
          age_policy,
          series_id,
          venue:venues!events_venue_id_fkey(
            id,
            name,
            slug,
            neighborhood,
            city,
            image_url,
            lat,
            lng
          ),
          series:series!events_series_id_fkey(
            id,
            slug,
            title
          )
        `,
        )
        .eq("start_date", date)
        .not("start_time", "is", null)
        .order("start_time", { ascending: true })
        .limit(STAGE_EVENT_LIMIT);

      // Apply category filter: single category or both stage categories
      if (categoryFilter) {
        stageQuery = stageQuery.eq("category_id", categoryFilter);
      } else {
        stageQuery = stageQuery.in("category_id", [...STAGE_CATEGORIES]);
      }

      stageQuery = applyFeedGate(stageQuery);
      stageQuery = applyFederatedPortalScopeToQuery(stageQuery, {
        portalId,
        publicOnlyWhenNoPortal: true,
        sourceIds: sourceAccess?.sourceIds ?? [],
      });

      const { data: events, error } = await stageQuery;

      if (error) {
        throw error;
      }

      const typedEvents = (events as unknown as StageEvent[] | null) ?? [];

      // Filter: must have venue, venue must be in portal city scope
      const shows: StageShow[] = typedEvents
        .filter((e) => isVenueInScope(e.venue, portalCity))
        .map(toShow);

      const responsePayload: Record<string, unknown> = { date, shows };

      if (includeMeta) {
        const dateWindowEnd = addDaysToDateString(date, STAGE_META_LOOKAHEAD_DAYS);

        // Meta query: also apply feed gate, portal scope, and city scope
        let metaQuery = supabase
          .from("events")
          .select(
            `
            start_date,
            venue:venues!events_venue_id_fkey(city)
          `,
          )
          .or("is_feed_ready.eq.true,is_feed_ready.is.null")
          .gte("start_date", date)
          .lte("start_date", dateWindowEnd)
          .not("start_time", "is", null)
          .order("start_date", { ascending: true })
          .limit(STAGE_META_DATE_LIMIT);

        if (categoryFilter) {
          metaQuery = metaQuery.eq("category_id", categoryFilter);
        } else {
          metaQuery = metaQuery.in("category_id", [...STAGE_CATEGORIES]);
        }

        metaQuery = applyFederatedPortalScopeToQuery(metaQuery, {
          portalId,
          publicOnlyWhenNoPortal: true,
          sourceIds: sourceAccess?.sourceIds ?? [],
        });

        const { data: metaRows } = await metaQuery;

        type MetaRow = { start_date: string; venue: { city: string | null } | null };
        const typedMetaRows = (metaRows as unknown as MetaRow[] | null) ?? [];

        // Filter meta rows by city scope too
        const scopedDates = typedMetaRows
          .filter((r) => {
            if (!r.venue) return false;
            if (!r.venue.city) return false;
            return r.venue.city.toLowerCase() === portalCity.toLowerCase();
          })
          .map((r) => r.start_date);

        const available_dates = [...new Set(scopedDates)];

        responsePayload.meta = { available_dates };
      }

      return responsePayload;
    },
    { maxEntries: STAGE_CACHE_MAX_ENTRIES },
  );

  const response = NextResponse.json(result);
  response.headers.set(
    "Cache-Control",
    "public, s-maxage=300, stale-while-revalidate=600",
  );
  return response;
}
