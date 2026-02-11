import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { getLocalDateString } from "@/lib/formats";

// Cache 5 min public, 10 min stale-while-revalidate
export const revalidate = 300;

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  // Default to today
  const date = searchParams.get("date") || getLocalDateString(new Date());

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Invalid date format. Use YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const { data: events, error } = await supabase
    .from("events")
    .select(`
      id,
      title,
      start_time,
      image_url,
      tags,
      series_id,
      venue:venues!events_venue_id_fkey(
        id,
        name,
        slug,
        neighborhood
      ),
      series:series!events_series_id_fkey(
        id,
        title,
        image_url
      )
    `)
    .eq("start_date", date)
    .contains("tags", ["showtime"])
    .not("start_time", "is", null)
    .order("start_time", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch showtimes" },
      { status: 500 }
    );
  }

  // Group by film (series_id when available, otherwise by title)
  type ShowtimeEvent = NonNullable<typeof events>[number];

  const filmMap = new Map<
    string,
    {
      title: string;
      series_id: string | null;
      image_url: string | null;
      theaters: Map<
        number,
        {
          venue_id: number;
          venue_name: string;
          venue_slug: string;
          neighborhood: string | null;
          times: string[];
        }
      >;
    }
  >();

  for (const event of events || []) {
    const venue = event.venue as { id: number; name: string; slug: string; neighborhood: string | null } | null;
    if (!venue) continue;

    const series = event.series as { id: string; title: string; image_url: string | null } | null;

    // Group key: prefer series_id for accurate grouping across venues
    const groupKey = event.series_id || `title:${event.title.toLowerCase().trim()}`;

    let film = filmMap.get(groupKey);
    if (!film) {
      film = {
        title: series?.title || event.title,
        series_id: event.series_id,
        image_url: series?.image_url || event.image_url,
        theaters: new Map(),
      };
      filmMap.set(groupKey, film);
    }

    // Use best available image
    if (!film.image_url && event.image_url) {
      film.image_url = event.image_url;
    }

    let theater = film.theaters.get(venue.id);
    if (!theater) {
      theater = {
        venue_id: venue.id,
        venue_name: venue.name,
        venue_slug: venue.slug,
        neighborhood: venue.neighborhood,
        times: [],
      };
      film.theaters.set(venue.id, theater);
    }

    if (event.start_time) {
      // Store as HH:MM (strip seconds if present)
      const time = event.start_time.slice(0, 5);
      if (!theater.times.includes(time)) {
        theater.times.push(time);
      }
    }
  }

  // Convert to response shape
  const films = Array.from(filmMap.values())
    .map((film) => ({
      title: film.title,
      series_id: film.series_id,
      image_url: film.image_url,
      theaters: Array.from(film.theaters.values()).map((theater) => ({
        venue_id: theater.venue_id,
        venue_name: theater.venue_name,
        venue_slug: theater.venue_slug,
        neighborhood: theater.neighborhood,
        times: theater.times.sort(),
      })),
    }))
    .sort((a, b) => b.theaters.length - a.theaters.length || a.title.localeCompare(b.title));

  const response = NextResponse.json({ date, films });
  response.headers.set(
    "Cache-Control",
    "public, s-maxage=300, stale-while-revalidate=600"
  );
  return response;
}
