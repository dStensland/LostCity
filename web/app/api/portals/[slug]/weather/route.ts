import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { successResponse, errorApiResponse } from "@/lib/api-utils";
import { getPortalWeather } from "@/lib/weather";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

// GET /api/portals/[slug]/weather — get cached weather for a portal
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await context.params;
  const supabase = await createClient();

  const { data: portal } = await supabase
    .from("portals")
    .select("id, filters")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  const portalData = portal as {
    id: string;
    filters: { geo_center?: [number, number] };
  } | null;

  if (!portalData) {
    return errorApiResponse("Portal not found", 404);
  }

  const geoCenter = portalData.filters?.geo_center;
  if (!geoCenter || geoCenter.length < 2) {
    return errorApiResponse("Portal has no geo_center configured", 400);
  }

  const weather = await getPortalWeather(
    portalData.id,
    geoCenter[0],
    geoCenter[1]
  );

  if (!weather) {
    return errorApiResponse("Weather data unavailable", 503);
  }

  return successResponse({ weather });
}
