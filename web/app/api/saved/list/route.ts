import { NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { withOptionalAuth } from "@/lib/api-middleware";
import { getLocalDateString } from "@/lib/formats";
import { logger } from "@/lib/logger";

/**
 * GET /api/saved/list
 * Lists saved items for the authenticated user.
 * Query params:
 * - category: filter by event category (e.g. "film")
 */
export const GET = withOptionalAuth(async (request, { user, serviceClient }) => {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  if (!user || !serviceClient) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const today = getLocalDateString();

    const query = serviceClient
      .from("saved_items")
      .select(`
        id,
        created_at,
        event_id,
        venue_id,
        event:events!saved_items_event_id_fkey(
          id,
          title,
          start_date,
          start_time,
          image_url,
          category,
          series_id,
          series:series!events_series_id_fkey(
            id,
            slug,
            title,
            image_url,
            genres
          ),
          venue:venues!events_venue_id_fkey(
            name,
            slug,
            neighborhood
          )
        ),
        venue:venues!saved_items_venue_id_fkey(
          id,
          name,
          slug,
          neighborhood,
          image_url
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      logger.error("Saved list query error", error, { userId: user.id, component: "saved-list" });
      return NextResponse.json({ error: "Failed to load saved items" }, { status: 500 });
    }

    type SavedItemRow = {
      id: number;
      created_at: string;
      event_id: number | null;
      venue_id: number | null;
      event: {
        id: number;
        title: string;
        start_date: string;
        start_time: string | null;
        image_url: string | null;
        category: string | null;
        series_id: string | null;
        series: {
          id: string;
          slug: string;
          title: string;
          image_url: string | null;
          genres: string[] | null;
        } | null;
        venue: {
          name: string;
          slug: string;
          neighborhood: string | null;
        } | null;
      } | null;
      venue: {
        id: number;
        name: string;
        slug: string;
        neighborhood: string | null;
        image_url: string | null;
      } | null;
    };

    let items = (data as unknown as SavedItemRow[]) || [];

    // Filter by category if specified
    if (category) {
      items = items.filter((item) => {
        if (item.event) return item.event.category === category;
        return false; // Venues don't have categories; exclude when filtering by category
      });
    }

    // Filter to only future events
    items = items.filter((item) => {
      if (item.event) return item.event.start_date >= today;
      return true; // Venues always included
    });

    return NextResponse.json({ items }, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    logger.error("Saved list API error", error, { userId: user?.id, component: "saved-list" });
    return NextResponse.json({ error: "Failed to load saved items" }, { status: 500 });
  }
});
