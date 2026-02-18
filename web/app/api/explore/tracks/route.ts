import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { getLocalDateString } from "@/lib/formats";
import { suppressVenueImagesIfFlagged } from "@/lib/image-quality-suppression";

export const revalidate = 900; // 15 min

type TrackRow = {
  id: number;
  slug: string;
  name: string;
  quote: string;
  quote_source: string;
  quote_portrait_url: string | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  accent_color: string | null;
  category: string | null;
  group_name: string | null;
  created_at: string;
  updated_at: string;
};

const MIN_VENUE_QUALITY = 50;

type TrackVenueRow = {
  id: number;
  editorial_blurb: string | null;
  is_featured: boolean;
  upvote_count: number;
  venues: {
    id: number;
    name: string;
    slug: string | null;
    neighborhood: string | null;
    short_description: string | null;
    image_url: string | null;
    hero_image_url: string | null;
    venue_type: string | null;
    data_quality: number | null;
  } | null;
};

type EventRow = {
  id: number;
  venue_id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_free: boolean | null;
  price_min: number | null;
};

/** Get end of weekend (Sunday) date string */
function getWeekendEnd(): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + daysUntilSunday);
  return getLocalDateString(sunday);
}

/**
 * GET /api/explore/tracks
 * Returns all active tracks with preview venues, activity counts, and featured event
 */
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const supabase = await createClient();
    const today = getLocalDateString();
    const weekendEnd = getWeekendEnd();

    // Fetch all active tracks
    const { data: tracks, error: tracksError } = await supabase
      .from("explore_tracks")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (tracksError) {
      console.error("Tracks fetch error:", tracksError);
      return NextResponse.json({ error: "Failed to fetch tracks" }, { status: 500 });
    }

    const typedTracks = tracks as unknown as TrackRow[];

    if (!typedTracks || typedTracks.length === 0) {
      return NextResponse.json(
        { tracks: [] },
        { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } }
      );
    }

    // Fetch venue counts and preview venues for each track
    const trackData = await Promise.all(
      typedTracks.map(async (track) => {
        const { count } = await supabase
          .from("explore_track_venues")
          .select("*", { count: "exact", head: true })
          .eq("track_id", track.id)
          .eq("status", "approved");

        const { data: rawTrackVenues } = await supabase
          .from("explore_track_venues")
          .select(`
            id, editorial_blurb, is_featured, upvote_count,
            venues (id, name, slug, neighborhood, short_description, image_url, hero_image_url, venue_type, data_quality)
          `)
          .eq("track_id", track.id)
          .eq("status", "approved")
          .order("is_featured", { ascending: false })
          .order("sort_order", { ascending: true })
          .order("upvote_count", { ascending: false })
          .limit(8);

        const trackVenues = rawTrackVenues as unknown as TrackVenueRow[] | null;

        // Filter out venues that were scored below quality threshold
        // NULL data_quality = not yet scored, so let them through (curated track venues)
        const qualifiedVenues = (trackVenues ?? []).filter(
          (tv) => !tv.venues || tv.venues.data_quality === null || tv.venues.data_quality >= MIN_VENUE_QUALITY
        );

        return { track, venueCount: count ?? 0, trackVenues: qualifiedVenues };
      })
    );

    // Collect all preview venue IDs for batch event queries
    const allVenueIds = new Set<number>();
    // Also build track→venueIds map for per-track aggregation
    const trackVenueMap = new Map<number, number[]>();

    for (const td of trackData) {
      const vIds: number[] = [];
      for (const tv of td.trackVenues) {
        if (tv.venues?.id) {
          allVenueIds.add(tv.venues.id);
          vIds.push(tv.venues.id);
        }
      }
      trackVenueMap.set(td.track.id, vIds);
    }

    // Batch fetch upcoming events with richer data for activity signals
    const eventsByVenue = new Map<number, EventRow[]>();
    if (allVenueIds.size > 0) {
      const { data: rawEvents } = await supabase
        .from("events")
        .select("id, venue_id, title, start_date, start_time, is_free, price_min")
        .in("venue_id", Array.from(allVenueIds))
        .gte("start_date", today)
        .lte("start_date", weekendEnd) // Only need through weekend for pills
        .is("canonical_event_id", null)
        .is("portal_id", null)
        .or("is_class.eq.false,is_class.is.null")
        .or("is_sensitive.eq.false,is_sensitive.is.null")
        .order("start_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(500);

      const events = rawEvents as unknown as EventRow[] | null;
      if (events) {
        for (const e of events) {
          const list = eventsByVenue.get(e.venue_id) ?? [];
          list.push(e);
          eventsByVenue.set(e.venue_id, list);
        }
      }
    }

    // Also fetch total upcoming count (beyond weekend) for venue badges
    const eventCountsByVenue = new Map<number, number>();
    if (allVenueIds.size > 0) {
      const { data: rawCounts } = await supabase
        .from("events")
        .select("venue_id")
        .in("venue_id", Array.from(allVenueIds))
        .gte("start_date", today)
        .is("canonical_event_id", null)
        .is("portal_id", null)
        .or("is_class.eq.false,is_class.is.null")
        .or("is_sensitive.eq.false,is_sensitive.is.null");

      const countEvents = rawCounts as unknown as { venue_id: number }[] | null;
      if (countEvents) {
        for (const e of countEvents) {
          eventCountsByVenue.set(e.venue_id, (eventCountsByVenue.get(e.venue_id) ?? 0) + 1);
        }
      }
    }

    // Build per-track activity aggregates
    const trackVenueNameMap = new Map<number, string>(); // venueId → name for featured event
    for (const td of trackData) {
      for (const tv of td.trackVenues) {
        if (tv.venues) trackVenueNameMap.set(tv.venues.id, tv.venues.name);
      }
    }

    // Build response
    const enrichedTracks = trackData.map(({ track, venueCount, trackVenues }) => {
      const vIds = trackVenueMap.get(track.id) ?? [];

      // Aggregate events across all venues in this track
      let tonightCount = 0;
      let weekendCount = 0;
      let freeCount = 0;
      let featuredEvent: {
        title: string;
        date: string;
        time: string | null;
        venue_name: string;
        is_free: boolean;
      } | null = null;

      for (const vId of vIds) {
        const venueEvents = eventsByVenue.get(vId) ?? [];
        for (const ev of venueEvents) {
          if (ev.start_date === today) tonightCount++;
          weekendCount++;
          if (ev.is_free) freeCount++;
          // Pick first chronological event as featured (most imminent)
          if (!featuredEvent) {
            featuredEvent = {
              title: ev.title,
              date: ev.start_date,
              time: ev.start_time,
              venue_name: trackVenueNameMap.get(ev.venue_id) ?? "",
              is_free: ev.is_free ?? false,
            };
          }
        }
      }

      return {
        ...track,
        venue_count: venueCount,
        tonight_count: tonightCount,
        weekend_count: weekendCount,
        free_count: freeCount,
        featured_event: featuredEvent,
        preview_venues: trackVenues.map((tv) => ({
          id: tv.id,
          editorial_blurb: tv.editorial_blurb,
          is_featured: tv.is_featured,
          upvote_count: tv.upvote_count,
          venue: tv.venues ? suppressVenueImagesIfFlagged(tv.venues) : null,
          upcoming_event_count: tv.venues?.id ? (eventCountsByVenue.get(tv.venues.id) ?? 0) : 0,
        })),
      };
    });

    return NextResponse.json(
      { tracks: enrichedTracks },
      { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } }
    );
  } catch (error) {
    console.error("Tracks API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
