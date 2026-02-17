import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { getLocalDateString } from "@/lib/formats";

export const revalidate = 300; // 5 min

type RouteContext = {
  params: Promise<{ slug: string }>;
};

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
};

const MIN_VENUE_QUALITY = 50;

type TrackVenueRow = {
  id: number;
  editorial_blurb: string | null;
  source_url: string | null;
  source_label: string | null;
  is_featured: boolean;
  upvote_count: number;
  sort_order: number | null;
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

type TipRow = {
  id: number;
  venue_id: number;
  content: string;
  upvote_count: number;
  is_verified_visitor: boolean;
  created_at: string;
};

type EventRow = {
  id: number;
  venue_id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  category: string | null;
  is_free: boolean | null;
  price_min: number | null;
  price_max: number | null;
};

type HighlightRow = {
  id: number;
  venue_id: number;
  highlight_type: string;
  title: string;
  description: string | null;
  sort_order: number;
};

/**
 * GET /api/explore/tracks/[slug]
 * Returns single track with all approved venues, top tip per venue,
 * alive badges, and upcoming events per venue
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const { slug } = await context.params;
    const supabase = await createClient();
    const today = getLocalDateString();

    // Fetch track
    const { data: track, error: trackError } = await supabase
      .from("explore_tracks")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (trackError) {
      console.error("Track fetch error:", trackError);
      return NextResponse.json({ error: "Failed to fetch track" }, { status: 500 });
    }

    const typedTrack = track as unknown as TrackRow;

    if (!typedTrack) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }

    // Fetch all approved venues for this track
    const { data: rawTrackVenues, error: venuesError } = await supabase
      .from("explore_track_venues")
      .select(`
        id,
        editorial_blurb,
        source_url,
        source_label,
        is_featured,
        upvote_count,
        sort_order,
        venues (
          id,
          name,
          slug,
          neighborhood,
          short_description,
          image_url,
          hero_image_url,
          venue_type,
          data_quality
        )
      `)
      .eq("track_id", typedTrack.id)
      .eq("status", "approved")
      .order("is_featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("upvote_count", { ascending: false });

    if (venuesError) {
      console.error("Venues fetch error:", venuesError);
      return NextResponse.json({ error: "Failed to fetch venues" }, { status: 500 });
    }

    const allTrackVenues = rawTrackVenues as unknown as TrackVenueRow[] | null;

    // Filter out venues that were scored below quality threshold
    // NULL data_quality = not yet scored, so let them through (curated track venues)
    const trackVenues = (allTrackVenues ?? []).filter(
      (tv) => !tv.venues || tv.venues.data_quality === null || tv.venues.data_quality >= MIN_VENUE_QUALITY
    );

    if (trackVenues.length === 0) {
      return NextResponse.json(
        { track: typedTrack, venues: [] },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
          },
        }
      );
    }

    const venueIds = trackVenues
      .map((tv) => (tv.venues as { id: number } | null)?.id)
      .filter((id): id is number => id !== null && id !== undefined);

    // Fetch top tip for each venue (approved only)
    const { data: rawTips } = await supabase
      .from("explore_tips")
      .select("id, venue_id, content, upvote_count, is_verified_visitor, created_at")
      .in("venue_id", venueIds)
      .eq("status", "approved")
      .order("upvote_count", { ascending: false })
      .order("created_at", { ascending: false });

    const tips = rawTips as unknown as TipRow[] | null;

    // Build map of venue_id -> top tip
    const topTipByVenue = new Map<number, TipRow>();
    if (tips) {
      for (const tip of tips) {
        if (!topTipByVenue.has(tip.venue_id)) {
          topTipByVenue.set(tip.venue_id, tip);
        }
      }
    }

    // Fetch upcoming events for all venues (next 3 per venue, within 14 days)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const futureDateStr = getLocalDateString(futureDate);

    const { data: rawEvents } = await supabase
      .from("events")
      .select("id, venue_id, title, start_date, start_time, end_time, category, is_free, price_min, price_max")
      .in("venue_id", venueIds)
      .gte("start_date", today)
      .lte("start_date", futureDateStr)
      .is("canonical_event_id", null)
      .is("portal_id", null)
      .or("is_class.eq.false,is_class.is.null")
      .or("is_sensitive.eq.false,is_sensitive.is.null")
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(200);

    const allEvents = rawEvents as unknown as EventRow[] | null;

    // Group events by venue, max 3 per venue
    const eventsByVenue = new Map<number, EventRow[]>();
    if (allEvents) {
      for (const ev of allEvents) {
        const list = eventsByVenue.get(ev.venue_id) ?? [];
        if (list.length < 3) {
          list.push(ev);
          eventsByVenue.set(ev.venue_id, list);
        }
      }
    }

    // Fetch venue highlights
    const { data: rawHighlights } = await supabase
      .from("venue_highlights")
      .select("id, venue_id, highlight_type, title, description, sort_order")
      .in("venue_id", venueIds)
      .order("sort_order", { ascending: true });

    const allHighlights = rawHighlights as unknown as HighlightRow[] | null;

    // Group highlights by venue
    const highlightsByVenue = new Map<number, HighlightRow[]>();
    if (allHighlights) {
      for (const h of allHighlights) {
        const list = highlightsByVenue.get(h.venue_id) ?? [];
        list.push(h);
        highlightsByVenue.set(h.venue_id, list);
      }
    }

    // Track-level aggregates
    let tonightCount = 0;
    let weekendCount = 0;
    let freeCount = 0;

    // Get weekend end
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const sunday = new Date(now);
    sunday.setDate(now.getDate() + daysUntilSunday);
    const weekendEnd = getLocalDateString(sunday);

    if (allEvents) {
      for (const ev of allEvents) {
        if (ev.start_date === today) tonightCount++;
        if (ev.start_date <= weekendEnd) weekendCount++;
        if (ev.is_free) freeCount++;
      }
    }

    // Enrich venues with tips and event data
    const enrichedVenues = trackVenues.map((tv) => {
      const venue = tv.venues as {
        id: number;
        name: string;
        slug: string | null;
        neighborhood: string | null;
        short_description: string | null;
        image_url: string | null;
        hero_image_url: string | null;
        venue_type: string | null;
      } | null;

      if (!venue) return null;

      const topTip = topTipByVenue.get(venue.id);
      const venueEvents = eventsByVenue.get(venue.id) ?? [];
      const venueHighlights = highlightsByVenue.get(venue.id) ?? [];

      return {
        track_venue_id: tv.id,
        editorial_blurb: tv.editorial_blurb,
        source_url: tv.source_url,
        source_label: tv.source_label,
        is_featured: tv.is_featured,
        upvote_count: tv.upvote_count,
        venue: {
          ...venue,
          upcoming_event_count: venueEvents.length,
        },
        highlights: venueHighlights.map((h) => ({
          id: h.id,
          highlight_type: h.highlight_type,
          title: h.title,
          description: h.description,
        })),
        upcoming_events: venueEvents.map((ev) => ({
          id: ev.id,
          title: ev.title,
          start_date: ev.start_date,
          start_time: ev.start_time,
          end_time: ev.end_time,
          category: ev.category,
          is_free: ev.is_free ?? false,
          price_min: ev.price_min,
          price_max: ev.price_max,
          is_tonight: ev.start_date === today,
        })),
        top_tip: topTip ? {
          id: topTip.id,
          content: topTip.content,
          upvote_count: topTip.upvote_count,
          is_verified_visitor: topTip.is_verified_visitor,
        } : null,
      };
    }).filter((v) => v !== null);

    return NextResponse.json(
      {
        track: typedTrack,
        venues: enrichedVenues,
        activity: {
          tonight_count: tonightCount,
          weekend_count: weekendCount,
          free_count: freeCount,
          venue_count: trackVenues.length,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
        },
      }
    );
  } catch (error) {
    console.error("Track detail API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
