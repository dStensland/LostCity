import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { getLocalDateString } from "@/lib/formats";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import { applyPortalScopeToQuery, filterByPortalCity } from "@/lib/portal-scope";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  const searchParams = request.nextUrl.searchParams;
  const portalExclusive = searchParams.get("portal_exclusive") === "true";

  if (!slug) {
    return Response.json({ error: "Invalid slug" }, { status: 400 });
  }

  const supabase = await createClient();
  const portalContext = await resolvePortalQueryContext(supabase, searchParams);
  if (portalContext.hasPortalParamMismatch) {
    return Response.json(
      { error: "portal and portal_id parameters must reference the same portal" },
      { status: 400 }
    );
  }
  const portalCity = !portalExclusive ? portalContext.filters.city : undefined;

  // Fetch series data
  const { data: seriesData, error } = await supabase
    .from("series")
    .select(`
      *,
      festival:festivals(id, slug, name, image_url, festival_type, location, neighborhood)
    `)
    .eq("slug", slug)
    .maybeSingle();

  if (error || !seriesData) {
    return Response.json({ error: "Series not found" }, { status: 404 });
  }

  // Cast to avoid TypeScript 'never' type issue
  const series = seriesData as { id: string; [key: string]: unknown };

  // Get today's date for filtering upcoming events
  const today = getLocalDateString();

  // Fetch upcoming events for this series with venue info
  let eventsQuery = supabase
    .from("events")
    .select(`
      id, title, start_date, start_time, ticket_url,
      venue:venues(id, name, slug, neighborhood, city)
    `)
    .eq("series_id", series.id)
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(50);

  eventsQuery = applyPortalScopeToQuery(eventsQuery, {
    portalId: portalContext.portalId,
    portalExclusive,
    publicOnlyWhenNoPortal: true,
  });

  const { data: eventsData } = await eventsQuery;

  // Group events by venue
  type EventWithVenue = {
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    ticket_url: string | null;
      venue: {
        id: number;
        name: string;
        slug: string;
        neighborhood: string | null;
        city?: string | null;
      } | null;
  };

  const events = filterByPortalCity((eventsData || []) as EventWithVenue[], portalCity, {
    allowMissingCity: true,
  });

  // Group by venue
  const venueMap = new Map<number, {
    venue: NonNullable<EventWithVenue["venue"]>;
    events: { id: number; date: string; time: string | null; ticketUrl: string | null }[];
  }>();

  for (const event of events) {
    if (!event.venue) continue;

    if (!venueMap.has(event.venue.id)) {
      venueMap.set(event.venue.id, {
        venue: event.venue,
        events: [],
      });
    }

    venueMap.get(event.venue.id)!.events.push({
      id: event.id,
      date: event.start_date,
      time: event.start_time,
      ticketUrl: event.ticket_url,
    });
  }

  const venueShowtimes = Array.from(venueMap.values());

  return Response.json({
    series: seriesData,
    events: events,
    venueShowtimes,
  }, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"
    }
  });
}
