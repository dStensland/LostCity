import { createClient, createPortalScopedClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import { applyPortalScopeToQuery, excludeSensitiveEvents, filterByPortalCity } from "@/lib/portal-scope";
import { applyFeedGate } from "@/lib/feed-gate";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";

type LiveEventRow = {
  id: number;
  title: string;
  start_time: string;
  end_time: string | null;
  is_all_day: boolean;
  category: string | null;
  tags: string[] | null;
  price_min: number | null;
  price_max: number | null;
  is_free: boolean;
  ticket_url: string | null;
  is_live: boolean;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
    city: string | null;
    lat: number | null;
    lng: number | null;
    place_type: string | null;
  } | null;
};

export async function GET(request: Request) {
  // Rate limit: read endpoint
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const { searchParams } = new URL(request.url);
    const portalExclusive = searchParams.get("portal_exclusive") === "true";

    const supabase = await createClient();
    const portalContext = await resolvePortalQueryContext(supabase, searchParams);
    if (portalContext.hasPortalParamMismatch) {
      return Response.json(
        { error: "portal and portal_id parameters must reference the same portal", events: [], count: 0 },
        { status: 400 }
      );
    }
    const portalClient = await createPortalScopedClient(portalContext.portalId);
    const portalCity = !portalExclusive ? portalContext.filters.city : undefined;

    const todayDate = new Date().toISOString().slice(0, 10);
    const cacheKey = `${portalContext.portalId ?? "none"}|${portalExclusive}|${todayDate}`;

    type LiveResponsePayload = { events: (LiveEventRow & { going_count: number })[]; count: number };

    const payload = await getOrSetSharedCacheJson<LiveResponsePayload>(
      "api:events-live",
      cacheKey,
      30 * 1000,
      async () => {
        // Get all currently live events with venue info
        let query = portalClient
          .from("events")
          .select(`
            id,
            title,
            start_time,
            end_time,
            is_all_day,
            category_id,
            tags,
            price_min,
            price_max,
            is_free,
            ticket_url,
            is_live,
            venue:places!events_place_id_fkey(
              id,
              name,
              neighborhood,
              city,
              lat,
              lng,
              place_type
            )
          `)
          .eq("is_live", true)
          .is("canonical_event_id", null) // Only show canonical events, not duplicates
          .order("start_time", { ascending: true });

        query = applyFeedGate(query);
        query = applyPortalScopeToQuery(query, {
          portalId: portalContext.portalId,
          portalExclusive,
          publicOnlyWhenNoPortal: true,
        });
        query = excludeSensitiveEvents(query);

        const { data, error } = await query;

        if (error) {
          throw error;
        }

        const events = filterByPortalCity((data as LiveEventRow[] | null) || [], portalCity, {
          allowMissingCity: true,
        });

        // Get RSVP counts for live events
        const eventIds = events.map((e) => e.id);
        let goingCounts: Record<number, number> = {};

        if (eventIds.length > 0) {
          const { data: rsvpData } = await supabase
            .from("event_rsvps")
            .select("event_id")
            .in("event_id", eventIds)
            .eq("status", "going");

          const rsvps = rsvpData as { event_id: number }[] | null;
          if (rsvps) {
            goingCounts = rsvps.reduce((acc, rsvp) => {
              acc[rsvp.event_id] = (acc[rsvp.event_id] || 0) + 1;
              return acc;
            }, {} as Record<number, number>);
          }
        }

        // Filter regular showtimes from live events
        const nonShowtimeEvents = events.filter(
          (event) => !event.tags?.includes("showtime")
        );

        // Enrich events with counts
        const enrichedEvents = nonShowtimeEvents.map((event) => ({
          ...event,
          going_count: goingCounts[event.id] || 0,
        }));

        return { events: enrichedEvents, count: enrichedEvents.length };
      },
      { maxEntries: 50 },
    );

    return Response.json(payload, {
      headers: {
        // Live events change frequently - short cache
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    logger.error("Live events API error:", error);
    return Response.json(
      { error: "Failed to fetch live events", events: [], count: 0 },
      { status: 500 }
    );
  }
}
