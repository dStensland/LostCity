import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getMoodConfig, type OnboardingMood } from "@/lib/preferences";

type PortalRow = {
  id: string;
  allowed_categories: string[] | null;
};

type EventRow = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  category: string | null;
  image_url: string | null;
  is_free: boolean;
  price_min: number | null;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
  } | null;
  producer: {
    id: number;
    name: string;
    slug: string;
  } | null;
};

type SwipeDeckEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  category: string | null;
  image_url: string | null;
  is_free: boolean;
  price_min: number | null;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
  } | null;
  producer: {
    id: number;
    name: string;
    slug: string;
  } | null;
};

export async function GET(request: Request) {
  const rateLimitResult = applyRateLimit(request, RATE_LIMITS.read);
  if (rateLimitResult) return rateLimitResult;

  try {
    const { searchParams } = new URL(request.url);
    const mood = searchParams.get("mood") as OnboardingMood | null;
    const portalId = searchParams.get("portal_id") || null;
    const limit = Math.min(parseInt(searchParams.get("limit") || "8", 10), 12);

    const supabase = await createClient();

    // Calculate date range: next 14 days
    const today = new Date();
    const twoWeeksOut = new Date(today);
    twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);

    const todayStr = today.toISOString().split("T")[0];
    const twoWeeksStr = twoWeeksOut.toISOString().split("T")[0];

    // Get mood config for category filtering
    const moodConfig = mood ? getMoodConfig(mood) : null;
    const categoryFilter = moodConfig?.categories || null;

    // Build query for diverse events with images
    let query = supabase
      .from("events")
      .select(`
        id,
        title,
        start_date,
        start_time,
        category,
        image_url,
        is_free,
        price_min,
        venue:venues!events_venue_id_fkey(
          id,
          name,
          neighborhood
        ),
        producer:event_producers!events_producer_id_fkey(
          id,
          name,
          slug
        )
      `)
      .gte("start_date", todayStr)
      .lte("start_date", twoWeeksStr)
      .not("image_url", "is", null)
      .is("canonical_event_id", null); // Only canonical events

    // Apply category filter if mood selected
    if (categoryFilter && categoryFilter.length > 0) {
      query = query.in("category", categoryFilter);
    }

    // Apply portal filter if specified
    if (portalId) {
      // Get portal's allowed categories/sources
      const { data: portal } = await supabase
        .from("portals")
        .select("id, allowed_categories")
        .eq("id", portalId)
        .single();

      const portalData = portal as PortalRow | null;
      if (portalData?.allowed_categories && portalData.allowed_categories.length > 0) {
        // If mood filter is set, intersect with portal categories
        if (categoryFilter) {
          const intersection = categoryFilter.filter((c: string) =>
            portalData.allowed_categories!.includes(c)
          );
          if (intersection.length > 0) {
            query = query.in("category", intersection);
          }
        } else {
          query = query.in("category", portalData.allowed_categories);
        }
      }
    }

    // Order by start date and limit
    query = query.order("start_date", { ascending: true }).limit(50);

    const { data: rawEvents, error } = await query;

    if (error) {
      throw error;
    }

    // Process to get diverse set (max 2 per category)
    const categoryCounts: Record<string, number> = {};
    const diverseEvents: SwipeDeckEvent[] = [];
    const events = (rawEvents || []) as EventRow[];

    for (const event of events) {
      const category = event.category || "other";
      const currentCount = categoryCounts[category] || 0;

      // Max 2 events per category for diversity
      if (currentCount < 2) {
        categoryCounts[category] = currentCount + 1;

        diverseEvents.push({
          id: event.id,
          title: event.title,
          start_date: event.start_date,
          start_time: event.start_time,
          category: event.category,
          image_url: event.image_url,
          is_free: event.is_free,
          price_min: event.price_min,
          venue: event.venue,
          producer: event.producer,
        });

        if (diverseEvents.length >= limit) {
          break;
        }
      }
    }

    // Mix of free and paid events (shuffle slightly)
    const freeEvents = diverseEvents.filter((e) => e.is_free);
    const paidEvents = diverseEvents.filter((e) => !e.is_free);

    // Interleave free and paid for variety
    const shuffledEvents: SwipeDeckEvent[] = [];
    const maxLen = Math.max(freeEvents.length, paidEvents.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < freeEvents.length) shuffledEvents.push(freeEvents[i]);
      if (i < paidEvents.length) shuffledEvents.push(paidEvents[i]);
    }

    return Response.json(
      {
        events: shuffledEvents.slice(0, limit),
        count: shuffledEvents.length,
        mood: mood || null,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Swipe deck API error:", error);
    return Response.json(
      { error: "Failed to fetch swipe deck", events: [], count: 0 },
      { status: 500 }
    );
  }
}
