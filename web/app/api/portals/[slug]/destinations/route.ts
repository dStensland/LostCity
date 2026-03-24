import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { successResponse, errorApiResponse } from "@/lib/api-utils";
import { fetchDestinations } from "@/lib/city-pulse/pipeline/fetch-destinations";

export type { DestinationItem } from "@/lib/city-pulse/pipeline/fetch-destinations";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  // slug is available for future portal-specific filtering
  const { slug } = await context.params;

  try {
    const supabase = await createClient();
    const destinations = await fetchDestinations(supabase, slug);

    return successResponse(
      { destinations },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("[GET /api/portals/[slug]/destinations]", error);
    return errorApiResponse("Failed to load destinations", 500);
  }
}
