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
  image_url: string | null;
  venue: MusicVenue | null;
  event_artists: MusicArtist[] | null;
};

type ShowShape = {
  event_id: number;
  title: string;
  start_time: string | null;
  is_free: boolean;
  tags: string[];
  genres: string[];
  age_policy: string | null;
  ticket_url: string | null;
  image_url: string | null;
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
  };
};

function toShow(event: MusicEvent): ShowShape {
  const artists = (event.event_artists ?? [])
    .slice()
    .sort((a, b) => {
      // Headliners first, then by billing_order ascending
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
    genres: event.genres ?? [],
    age_policy: event.age_policy,
    ticket_url: event.ticket_url,
    image_url: event.image_url,
    artists: artists.map((a) => ({
      name: a.name,
      is_headliner: a.is_headliner,
      billing_order: a.billing_order,
    })),
    // venue is guaranteed non-null at this point (filtered before calling toShow)
    venue: {
      id: event.venue!.id,
      name: event.venue!.name,
      slug: event.venue!.slug,
      neighborhood: event.venue!.neighborhood,
    },
  };
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

  const cacheKey = [date, includeMeta ? "1" : "0"].join("|");

  const result = await getOrSetSharedCacheJson<Record<string, unknown>>(
    MUSIC_CACHE_NAMESPACE,
    cacheKey,
    MUSIC_CACHE_TTL_MS,
    async () => {
      // Exclude Nashville events by filtering on venue city.
      // The Atlanta portal should only show Atlanta-metro events.
      const EXCLUDED_CITIES = ["Nashville", "Franklin", "Murfreesboro"];

      let musicQuery = supabase
        .from("events")
        .select(
          `
          id,
          title,
          start_time,
          is_free,
          tags,
          genres,
          age_policy,
          ticket_url,
          image_url,
          venue:venues!events_venue_id_fkey(
            id,
            name,
            slug,
            neighborhood,
            city
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

      const { data: events, error } = await musicQuery;

      if (error) {
        throw error;
      }

      const typedEvents = (events as unknown as MusicEvent[] | null) ?? [];

      // Filter out events with no venue or in excluded cities (Nashville leak)
      const shows: ShowShape[] = typedEvents
        .filter((e) => e.venue !== null && !EXCLUDED_CITIES.includes(e.venue!.city ?? ""))
        .map(toShow);

      const responsePayload: Record<string, unknown> = { date, shows };

      if (includeMeta) {
        const dateWindowEnd = addDaysToDateString(date, MUSIC_META_LOOKAHEAD_DAYS);

        const { data: dateRows } = await supabase
          .from("events")
          .select("start_date")
          .eq("category_id", "music")
          .gte("start_date", date)
          .lte("start_date", dateWindowEnd)
          .not("start_time", "is", null)
          .order("start_date", { ascending: true })
          .limit(MUSIC_META_DATE_LIMIT);

        const available_dates = [
          ...new Set(
            (
              (dateRows as unknown as { start_date: string }[] | null) ?? []
            ).map((r) => r.start_date),
          ),
        ];

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
