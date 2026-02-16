import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

  // Use anon client — this is a public endpoint
  const supabase = await createClient();

  const { data: itinerary, error } = await supabase
    .from("itineraries")
    .select("*")
    .eq("share_token", token)
    .eq("is_public", true)
    .maybeSingle();

  if (error) {
    console.error("Error fetching shared itinerary:", error.message);
    return errorApiResponse("Failed to fetch itinerary", 500);
  }

  if (!itinerary) {
    return errorApiResponse("Itinerary not found or not shared", 404);
  }

  const itineraryData = itinerary as { id: string };

  // Fetch items with joined data
  const { data: items } = await supabase
    .from("itinerary_items")
    .select(
      `
      *,
      event:events(id, title, start_date, start_time, image_url, category, lat, lng),
      venue:venues(id, slug, name, image_url, neighborhood, venue_type, lat, lng)
    `
    )
    .eq("itinerary_id", itineraryData.id)
    .order("position", { ascending: true })
    .limit(100);

  // Fetch portal info for branding
  const itineraryWithPortal = itinerary as { portal_id: string };
  const { data: portal } = await supabase
    .from("portals")
    .select("id, slug, name, branding")
    .eq("id", itineraryWithPortal.portal_id)
    .maybeSingle();

  return successResponse({
    itinerary: { ...(itinerary as Record<string, unknown>), items: items || [] },
    portal: portal || null,
  });
}
