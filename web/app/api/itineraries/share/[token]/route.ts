import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import {
  isValidString,
  successResponse,
  errorApiResponse,
} from "@/lib/api-utils";

type RouteContext = {
  params: Promise<{ token: string }>;
};

// GET /api/itineraries/share/[token] — public access to shared itinerary
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.standard,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { token } = await context.params;

  if (!isValidString(token, 8, 32)) {
    return errorApiResponse("Invalid share token", 400);
  }

  // Use anon client for the initial lookup
  const supabase = await createClient();

  // Accept itineraries that are public OR invitees-visible (share link is the gate)
  const { data: itinerary, error } = await supabase
    .from("itineraries")
    .select("*")
    .eq("share_token", token)
    .in("visibility", ["public", "invitees"])
    .maybeSingle();

  if (error) {
    console.error("Error fetching shared itinerary:", error.message);
    return errorApiResponse("Failed to fetch itinerary", 500);
  }

  if (!itinerary) {
    return errorApiResponse("Itinerary not found or not shared", 404);
  }

  const itineraryData = itinerary as { id: string; portal_id: string };

  // Fetch items with joined data (events don't have lat/lng — join through venues)
  const { data: rawItems } = await supabase
    .from("itinerary_items")
    .select(
      `
      *,
      event:events(id, title, start_date, start_time, image_url, category:category_id, venue:places(name, lat, lng)),
      venue:places(id, slug, name, image_url, neighborhood, place_type, lat, lng)
    `
    )
    .eq("itinerary_id", itineraryData.id)
    .order("position", { ascending: true })
    .limit(100);

  // Flatten event.venue into event-level fields for frontend compatibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (rawItems || []).map((item: any) => {
    if (item.event?.venue) {
      const { venue: eventVenue, ...eventRest } = item.event;
      return {
        ...item,
        event: { ...eventRest, lat: eventVenue.lat, lng: eventVenue.lng, venue_name: eventVenue.name },
      };
    }
    return item;
  });

  // Fetch crew data using service client (bypasses RLS for public view)
  const serviceClient = createServiceClient();
  const { data: crew } = await serviceClient.rpc("get_itinerary_crew", {
    p_itinerary_id: itineraryData.id,
  } as never);

  // Fetch portal info for branding
  const { data: portal } = await supabase
    .from("portals")
    .select("id, slug, name, branding")
    .eq("id", itineraryData.portal_id)
    .maybeSingle();

  return successResponse({
    itinerary: {
      ...(itinerary as Record<string, unknown>),
      items: items || [],
      crew: crew || null,
    },
    portal: portal || null,
  });
}
