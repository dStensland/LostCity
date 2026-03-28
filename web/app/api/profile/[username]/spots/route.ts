import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import {
  isValidPositiveInt,
  checkBodySize,
  errorApiResponse,
  successResponse,
  createdResponse,
  validationError,
} from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import { MAX_REGULAR_SPOTS } from "@/lib/types/profile";

type RouteContext = {
  params: Promise<{ username: string }>;
};

// ============================================================================
// GET /api/profile/[username]/spots
//
// Returns the authenticated user's own regular spots (joined with venue data).
// Only the profile owner may read their own spots list via this route.
// Public spot visibility is handled by get_public_profile RPC.
// ============================================================================

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorApiResponse("Unauthorized", 401);
    }

    const { username } = await context.params;
    const serviceClient = createServiceClient();

    // Verify the requesting user owns this profile
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    const profileData = profile as { id: string } | null;

    if (!profileData) {
      return errorApiResponse("Profile not found", 404);
    }

    if (profileData.id !== user.id) {
      return errorApiResponse("Forbidden", 403);
    }

    // Fetch spots joined with venue data
    const { data: spots, error: fetchError } = await serviceClient
      .from("user_regular_spots")
      .select(
        `
        added_at,
        venues!inner(id, name, slug, neighborhood, image_url)
      `
      )
      .eq("user_id", user.id)
      .order("added_at", { ascending: false });

    if (fetchError) {
      logger.error("Error fetching regular spots", fetchError, { userId: user.id, component: "profile/spots" });
      return errorApiResponse("Failed to fetch spots", 500);
    }

    type SpotRow = {
      added_at: string;
      venues: {
        id: number;
        name: string;
        slug: string | null;
        neighborhood: string | null;
        image_url: string | null;
      };
    };

    const result = ((spots as SpotRow[] | null) ?? []).map((row) => ({
      venue_id: row.venues.id,
      name: row.venues.name,
      slug: row.venues.slug,
      neighborhood: row.venues.neighborhood,
      image_url: row.venues.image_url,
      added_at: row.added_at,
    }));

    return successResponse({ spots: result });
  } catch (error) {
    logger.error("Spots GET error", error, { component: "profile/spots" });
    return errorApiResponse("Internal server error", 500);
  }
}

// ============================================================================
// POST /api/profile/[username]/spots
//
// Adds a venue to the authenticated user's regular spots.
// Body: { venue_id: number }
// Max MAX_REGULAR_SPOTS spots enforced.
// ============================================================================

export async function POST(request: NextRequest, context: RouteContext) {
  const sizeCheck = checkBodySize(request, 1024);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorApiResponse("Unauthorized", 401);
    }

    const { username } = await context.params;
    const serviceClient = createServiceClient();

    // Verify the requesting user owns this profile
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    const profileData = profile as { id: string } | null;

    if (!profileData) {
      return errorApiResponse("Profile not found", 404);
    }

    if (profileData.id !== user.id) {
      return errorApiResponse("Forbidden", 403);
    }

    const body = await request.json();
    const { venue_id } = body;

    if (!isValidPositiveInt(venue_id)) {
      return validationError("venue_id must be a positive integer");
    }

    // Enforce max spots limit
    const { count, error: countError } = await serviceClient
      .from("user_regular_spots")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (countError) {
      logger.error("Error counting spots", countError, { userId: user.id, component: "profile/spots" });
      return errorApiResponse("Failed to add spot", 500);
    }

    if ((count ?? 0) >= MAX_REGULAR_SPOTS) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_REGULAR_SPOTS} regular spots allowed` },
        { status: 422 }
      );
    }

    // Verify the venue exists
    const { data: venue } = await serviceClient
      .from("places")
      .select("id, name, slug, neighborhood, image_url")
      .eq("id", venue_id)
      .maybeSingle();

    const venueData = venue as {
      id: number;
      name: string;
      slug: string | null;
      neighborhood: string | null;
      image_url: string | null;
    } | null;

    if (!venueData) {
      return errorApiResponse("Venue not found", 404);
    }

    // Insert (primary key constraint handles duplicates gracefully with ON CONFLICT)
    const { error: insertError } = await serviceClient
      .from("user_regular_spots")
      .insert({ user_id: user.id, place_id: venue_id } as never);

    if (insertError) {
      // PK violation = already added — treat as success
      if (insertError.code === "23505") {
        return successResponse({
          spot: {
            venue_id: venueData.id,
            name: venueData.name,
            slug: venueData.slug,
            neighborhood: venueData.neighborhood,
            image_url: venueData.image_url,
          },
        });
      }
      logger.error("Error inserting spot", insertError, { userId: user.id, venueId: venue_id, component: "profile/spots" });
      return errorApiResponse("Failed to add spot", 500);
    }

    return createdResponse({
      spot: {
        venue_id: venueData.id,
        name: venueData.name,
        slug: venueData.slug,
        neighborhood: venueData.neighborhood,
        image_url: venueData.image_url,
      },
    });
  } catch (error) {
    logger.error("Spots POST error", error, { component: "profile/spots" });
    return errorApiResponse("Internal server error", 500);
  }
}

// ============================================================================
// DELETE /api/profile/[username]/spots
//
// Removes a venue from the authenticated user's regular spots.
// Body: { venue_id: number }
// ============================================================================

export async function DELETE(request: NextRequest, context: RouteContext) {
  const sizeCheck = checkBodySize(request, 1024);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorApiResponse("Unauthorized", 401);
    }

    const { username } = await context.params;
    const serviceClient = createServiceClient();

    // Verify the requesting user owns this profile
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    const profileData = profile as { id: string } | null;

    if (!profileData) {
      return errorApiResponse("Profile not found", 404);
    }

    if (profileData.id !== user.id) {
      return errorApiResponse("Forbidden", 403);
    }

    const body = await request.json();
    const { venue_id } = body;

    if (!isValidPositiveInt(venue_id)) {
      return validationError("venue_id must be a positive integer");
    }

    const { error: deleteError } = await serviceClient
      .from("user_regular_spots")
      .delete()
      .eq("user_id", user.id)
      .eq("place_id", venue_id);

    if (deleteError) {
      logger.error("Error deleting spot", deleteError, { userId: user.id, venueId: venue_id, component: "profile/spots" });
      return errorApiResponse("Failed to remove spot", 500);
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error("Spots DELETE error", error, { component: "profile/spots" });
    return errorApiResponse("Internal server error", 500);
  }
}
