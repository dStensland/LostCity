import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPortalBySlug } from "@/lib/portal";
import { getLocalDateString } from "@/lib/formats";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { isValidUUID } from "@/lib/api-utils";
import { EXPLORE_CATEGORIES } from "@/lib/explore-constants";
import { applyPortalScopeToQuery } from "@/lib/portal-scope";
import { suppressVenueImagesIfFlagged } from "@/lib/image-quality-suppression";

export const revalidate = 900; // 15 min

type RouteContext = {
  params: Promise<{ slug: string }>;
};

// GET /api/portals/[slug]/explore - Get explore city guide data
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await context.params;
  const supabase = await createClient();

  try {
    const portal = await getPortalBySlug(slug);
    if (!portal || !isValidUUID(portal.id)) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    const today = getLocalDateString();

    // Collect all venue types mapped by explore categories
    const exploreVenueTypes = new Set(
      EXPLORE_CATEGORIES.flatMap((cat) => cat.venueTypes)
    );

    // Extract portal city filter for geographic scoping
    const portalFilters = portal.filters as { city?: string; cities?: string[] } | null;
    const portalCities = [
      ...(portalFilters?.cities || []),
      ...(portalFilters?.city ? [portalFilters.city] : []),
    ].filter(Boolean);

    // Fetch venues: either explicitly tagged with explore_category or matching explore venue types
    let venuesQuery = supabase
      .from("venues")
      .select(`
        id,
        name,
        slug,
        neighborhood,
        venue_type,
        short_description,
        explore_category,
        explore_featured,
        explore_blurb,
        hero_image_url,
        image_url
      `)
      .or(
        `explore_category.not.is.null,venue_type.in.(${Array.from(exploreVenueTypes).join(",")})`
      );

    // Scope venues to portal's city (prevent Nashville venues in Atlanta explore)
    if (portalCities.length > 0) {
      venuesQuery = venuesQuery.in("city", portalCities);
    }

    const { data: venues, error: venuesError } = await venuesQuery
      .order("name", { ascending: true })
      .limit(500);

    if (venuesError) {
      return NextResponse.json({ error: "Failed to fetch venues" }, { status: 500 });
    }

    type VenueRow = {
      id: number;
      name: string;
      slug: string | null;
      neighborhood: string | null;
      venue_type: string | null;
      short_description: string | null;
      explore_category: string | null;
      explore_featured: boolean | null;
      explore_blurb: string | null;
      hero_image_url: string | null;
      image_url: string | null;
    };

    const venueRows = (venues ?? []) as VenueRow[];

    if (venueRows.length === 0) {
      return NextResponse.json({
        featured: [],
        collections: [],
      }, {
        headers: {
          "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
        },
      });
    }

    // Fetch upcoming event counts per venue (single query, portal-scoped)
    const venueIds = venueRows.map((v) => v.id);
    let eventCountsQuery = supabase
      .from("events")
      .select("venue_id, id, title, start_date")
      .in("venue_id", venueIds)
      .gte("start_date", today)
      .is("canonical_event_id", null)
      .or("is_class.eq.false,is_class.is.null")
      .or("is_sensitive.eq.false,is_sensitive.is.null");

    eventCountsQuery = applyPortalScopeToQuery(eventCountsQuery, {
      portalId: portal.id,
      portalExclusive: false,
      publicOnlyWhenNoPortal: true,
    });

    const { data: eventCounts } = await eventCountsQuery
      .order("start_date", { ascending: true })
      .limit(2000);

    // Build per-venue event data
    const venueEventData = new Map<number, { count: number; nextTitle: string | null; nextDate: string | null }>();
    if (eventCounts) {
      for (const event of eventCounts as { venue_id: number; id: number; title: string; start_date: string }[]) {
        const existing = venueEventData.get(event.venue_id);
        if (existing) {
          existing.count++;
        } else {
          venueEventData.set(event.venue_id, {
            count: 1,
            nextTitle: event.title,
            nextDate: event.start_date,
          });
        }
      }
    }

    // Enrich venues with event data
    const enrichedVenues = venueRows.map((v) => {
      const eventData = venueEventData.get(v.id);
      const sanitizedVenue = suppressVenueImagesIfFlagged(v);
      return {
        id: sanitizedVenue.id,
        name: sanitizedVenue.name,
        slug: sanitizedVenue.slug,
        neighborhood: sanitizedVenue.neighborhood,
        venue_type: sanitizedVenue.venue_type,
        short_description: sanitizedVenue.short_description,
        explore_category: sanitizedVenue.explore_category,
        explore_featured: sanitizedVenue.explore_featured ?? false,
        explore_blurb: sanitizedVenue.explore_blurb,
        hero_image_url: sanitizedVenue.hero_image_url,
        image_url: sanitizedVenue.image_url,
        upcoming_event_count: eventData?.count ?? 0,
        next_event_title: eventData?.nextTitle ?? null,
        next_event_date: eventData?.nextDate ?? null,
      };
    });

    // Separate featured venues
    const featured = enrichedVenues.filter((v) => v.explore_featured);

    // Group by explore_category (explicit first, then infer from venue_type)
    const collections = EXPLORE_CATEGORIES.map((category) => {
      const categoryVenues = enrichedVenues.filter((v) => {
        if (v.explore_category === category.id) return true;
        if (!v.explore_category && v.venue_type && category.venueTypes.includes(v.venue_type)) return true;
        return false;
      });

      return {
        category,
        venues: categoryVenues.slice(0, 20), // Cap per category
      };
    }).filter((collection) => collection.venues.length > 0);

    return NextResponse.json(
      { featured, collections },
      {
        headers: {
          "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
        },
      }
    );
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
