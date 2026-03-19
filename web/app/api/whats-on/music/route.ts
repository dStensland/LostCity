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
import { applyFederatedPortalScopeToQuery, isVenueCityInScope } from "@/lib/portal-scope";
import { getPortalSourceAccess } from "@/lib/federation";

// ISR: revalidate every 5 minutes
export const revalidate = 300;

const MUSIC_CACHE_NAMESPACE = "api:whats-on:music";
const MUSIC_CACHE_TTL_MS = 3 * 60 * 1000;
const MUSIC_CACHE_MAX_ENTRIES = 90;
const MUSIC_EVENT_LIMIT = 200;
const MUSIC_META_DATE_LIMIT = 1000;
const MUSIC_META_LOOKAHEAD_DAYS = 30;

function addDaysToDateString(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setDate(parsed.getDate() + days);
  return getLocalDateString(parsed);
}

type MusicVenue = {
  id: number;
  name: string;
  slug: string;
  neighborhood: string | null;
  city: string | null;
  image_url: string | null;
  lat: number | null;
  lng: number | null;
};

type MusicArtist = {
  name: string;
  is_headliner: boolean;
  billing_order: number | null;
};

type MusicEvent = {
  id: number;
  title: string;
  start_time: string | null;
  is_free: boolean | null;
  tags: string[] | null;
  genres: string[] | null;
  age_policy: string | null;
  ticket_url: string | null;
  venue: MusicVenue | null;
  event_artists: MusicArtist[] | null;
};

type ShowShape = {
  event_id: number;
  title: string;
  start_time: string | null;
  is_free: boolean;
  tags: string[];
  age_policy: string | null;
  artists: {
    name: string;
    is_headliner: boolean;
    billing_order: number | null;
  }[];
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

function toShow(event: MusicEvent): ShowShape {
  const artists = (event.event_artists ?? [])
    .slice()
    .sort((a, b) => {
      if (a.is_headliner !== b.is_headliner) return a.is_headliner ? -1 : 1;
      const aOrder = a.billing_order ?? 9999;
      const bOrder = b.billing_order ?? 9999;
      return aOrder - bOrder;
    });

  return {
    event_id: event.id,
    title: event.title,
    start_time: event.start_time,
    is_free: event.is_free ?? false,
    tags: event.tags ?? [],
    age_policy: event.age_policy,
    artists: artists.map((a) => ({
      name: a.name,
      is_headliner: a.is_headliner,
      billing_order: a.billing_order,
    })),
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

/** Check if a venue is in the portal's city scope (uses metro expansion) */
function isVenueInScope(venue: MusicVenue | null, portalCity: string): boolean {
  if (!venue) return false;
  return isVenueCityInScope(venue.city, portalCity);
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

  const cacheKey = [date, includeMeta ? "1" : "0", portalCity, portalId ?? "none"].join("|");

  const result = await getOrSetSharedCacheJson<Record<string, unknown>>(
    MUSIC_CACHE_NAMESPACE,
    cacheKey,
    MUSIC_CACHE_TTL_MS,
    async () => {
      let musicQuery = supabase
        .from("events")
        .select(
          `
          id,
          title,
          start_time,
          is_free,
          tags,
          age_policy,
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
          event_artists(
            name,
            is_headliner,
            billing_order
          )
        `,
        )
        .eq("start_date", date)
        .eq("category_id", "music")
        .not("start_time", "is", null)
        .order("start_time", { ascending: true })
        .limit(MUSIC_EVENT_LIMIT);

      musicQuery = applyFeedGate(musicQuery);
      musicQuery = applyFederatedPortalScopeToQuery(musicQuery, {
        portalId,
        publicOnlyWhenNoPortal: true,
        sourceIds: sourceAccess?.sourceIds ?? [],
      });

      const { data: events, error } = await musicQuery;

      if (error) {
        throw error;
      }

      const typedEvents = (events as unknown as MusicEvent[] | null) ?? [];

      // Filter: must have venue, venue must be in portal city scope
      const shows: ShowShape[] = typedEvents
        .filter((e) => isVenueInScope(e.venue, portalCity))
        .map(toShow);

      const responsePayload: Record<string, unknown> = { date, shows };

      if (includeMeta) {
        const dateWindowEnd = addDaysToDateString(date, MUSIC_META_LOOKAHEAD_DAYS);

        // Meta query: also apply feed gate, portal scope, and city scope
        let metaQuery = supabase
          .from("events")
          .select(
            `
            start_date,
            venue:venues!events_venue_id_fkey(city)
          `,
          )
          .eq("category_id", "music")
          .or("is_feed_ready.eq.true,is_feed_ready.is.null")
          .gte("start_date", date)
          .lte("start_date", dateWindowEnd)
          .not("start_time", "is", null)
          .order("start_date", { ascending: true })
          .limit(MUSIC_META_DATE_LIMIT);

        metaQuery = applyFederatedPortalScopeToQuery(metaQuery, {
          portalId,
          publicOnlyWhenNoPortal: true,
          sourceIds: sourceAccess?.sourceIds ?? [],
        });

        const { data: metaRows } = await metaQuery;

        type MetaRow = { start_date: string; venue: { city: string | null } | null };
        const typedMetaRows = (metaRows as unknown as MetaRow[] | null) ?? [];

        // Filter meta rows by city scope too (uses metro expansion)
        const scopedDates = typedMetaRows
          .filter((r) => {
            if (!r.venue) return false;
            return isVenueCityInScope(r.venue.city, portalCity);
          })
          .map((r) => r.start_date);

        const available_dates = [...new Set(scopedDates)];

        responsePayload.meta = { available_dates };
      }

      return responsePayload;
    },
    { maxEntries: MUSIC_CACHE_MAX_ENTRIES },
  );

  const response = NextResponse.json(result);
  response.headers.set(
    "Cache-Control",
    "public, s-maxage=300, stale-while-revalidate=600",
  );
  return response;
}
