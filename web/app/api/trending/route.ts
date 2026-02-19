import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { format, startOfDay, addDays } from "date-fns";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import { applyPortalScopeToQuery, filterByPortalCity } from "@/lib/portal-scope";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";

const TRENDING_CACHE_TTL_MS = 60 * 1000;
const TRENDING_CACHE_MAX_ENTRIES = 200;
const TRENDING_CACHE_NAMESPACE = "api:trending";
const TRENDING_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const now = new Date();
    const today = format(startOfDay(now), "yyyy-MM-dd");
    const weekFromNow = format(addDays(startOfDay(now), 7), "yyyy-MM-dd");
    const hours48Ago = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    const { searchParams } = new URL(request.url);

    const supabase = await createClient();
    const portalContext = await resolvePortalQueryContext(supabase, searchParams);
    if (portalContext.hasPortalParamMismatch) {
      return NextResponse.json(
        { error: "portal and portal_id parameters must reference the same portal" },
        { status: 400 }
      );
    }
    const cacheKey = [
      portalContext.portalId || "no-portal",
      portalContext.filters.city || "all-cities",
    ].join("|");
    const payload = await getOrSetSharedCacheJson<{ events: unknown[] }>(
      TRENDING_CACHE_NAMESPACE,
      cacheKey,
      TRENDING_CACHE_TTL_MS,
      async () => {
        const portalCity = portalContext.filters.city || "Atlanta";

        // Get upcoming events this week
        let eventsQuery = supabase
          .from("events")
          .select(`
        id,
        title,
        start_date,
        start_time,
        end_date,
        end_time,
        is_all_day,
        is_free,
        category,
        image_url,
        series_id,
        series:series_id(
          id,
          slug,
          title,
          series_type,
          image_url,
          frequency,
          day_of_week,
          festival:festivals(id, slug, name, image_url, festival_type, location, neighborhood)
        ),
        venue:venues(id, name, slug, neighborhood, city, location_designator)
      `)
          .gte("start_date", today)
          .lte("start_date", weekFromNow)
          .eq("is_active", true)
          .is("canonical_event_id", null)
          .order("start_date", { ascending: true })
          .limit(120);

        eventsQuery = applyPortalScopeToQuery(eventsQuery, {
          portalId: portalContext.portalId,
          portalExclusive: false,
          publicOnlyWhenNoPortal: true,
        });

        const { data: eventsRaw } = await eventsQuery as { data: Array<{
            id: number;
            title: string;
            start_date: string;
            start_time: string | null;
            end_date: string | null;
            end_time: string | null;
            is_all_day: boolean;
            is_free: boolean;
            category: string | null;
            image_url: string | null;
            series_id?: string | null;
            series?: {
              id: string;
              slug: string;
              title: string;
              series_type: string;
              image_url: string | null;
              frequency: string | null;
              day_of_week: string | null;
              festival?: {
                id: string;
                slug: string;
                name: string;
                image_url: string | null;
                festival_type?: string | null;
                location: string | null;
                neighborhood: string | null;
              } | null;
            } | null;
            venue: {
              id: number;
              name: string;
              slug: string;
              neighborhood: string | null;
              city?: string | null;
              location_designator?:
                | "standard"
                | "private_after_signup"
                | "virtual"
                | "recovery_meeting"
                | null;
            } | null;
          }> | null };

        const events = filterByPortalCity(eventsRaw || [], portalCity, {
          allowMissingCity: true,
        });

        if (!events || events.length === 0) {
          return { events: [] };
        }

        const eventIds = events.map((e) => e.id);

    const recentRsvpsPromise = supabase
      .from("event_rsvps")
      .select("event_id")
      .in("event_id", eventIds)
      .gte("created_at", hours48Ago);
    const goingCountsPromise = supabase
      .from("event_rsvps")
      .select("event_id")
      .in("event_id", eventIds)
      .eq("status", "going");
    const [{ data: recentRsvps }, { data: goingCounts }] = await Promise.all([
      recentRsvpsPromise,
      goingCountsPromise,
    ]);
    const recentRsvpRows = (recentRsvps || []) as Array<{ event_id: number }>;
    const goingCountRows = (goingCounts || []) as Array<{ event_id: number }>;

    // Count recent RSVPs per event
    const recentRsvpCounts: Record<number, number> = {};
    for (const rsvp of recentRsvpRows) {
      recentRsvpCounts[rsvp.event_id] = (recentRsvpCounts[rsvp.event_id] || 0) + 1;
    }

    // Count total going per event
    const totalGoingCounts: Record<number, number> = {};
    for (const rsvp of goingCountRows) {
      totalGoingCounts[rsvp.event_id] = (totalGoingCounts[rsvp.event_id] || 0) + 1;
    }

    // Score events based on recent activity + total interest
    type EventWithScore = typeof events[0] & { score: number; going_count: number };
    const scored: EventWithScore[] = events.map((event) => ({
      ...event,
      score: (recentRsvpCounts[event.id] || 0) * 3 + (totalGoingCounts[event.id] || 0),
      going_count: totalGoingCounts[event.id] || 0,
    }));

    // Sort by score descending, take top 6
    scored.sort((a, b) => b.score - a.score);
    const trending = scored.slice(0, 6);

        return { events: trending };
      },
      { maxEntries: TRENDING_CACHE_MAX_ENTRIES }
    );

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": TRENDING_CACHE_CONTROL
      }
    });
  } catch (error) {
    console.error("Error in trending API:", error);
    return NextResponse.json({ events: [] }, { status: 500 });
  }
}
