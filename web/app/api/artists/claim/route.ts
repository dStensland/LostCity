import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { errorResponse, isValidString } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// POST /api/artists/claim — claim an unclaimed artist profile
export async function POST(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  try {
    // Auth check
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { artist_id } = body;

    if (!artist_id || !isValidString(artist_id, 1, 200)) {
      return NextResponse.json(
        { error: "artist_id is required" },
        { status: 400 }
      );
    }

    const serviceClient = createServiceClient();

    // Check if artist exists and is unclaimed
    const { data: artist, error: findError } = await serviceClient
      .from("artists")
      .select("id, name, claimed_by")
      .eq("id", artist_id)
      .maybeSingle();

    if (findError) {
      return errorResponse(findError, "POST /api/artists/claim (find)");
    }

    const artistData = artist as { id: string; name: string; claimed_by: string | null } | null;

    if (!artistData) {
      return NextResponse.json(
        { error: "Artist not found" },
        { status: 404 }
      );
    }

    if (artistData.claimed_by) {
      return NextResponse.json(
        { error: "This artist profile has already been claimed" },
        { status: 409 }
      );
    }

    // Check user hasn't already claimed another profile
    const { data: existingClaim } = await serviceClient
      .from("artists")
      .select("id, name")
      .eq("claimed_by", user.id)
      .maybeSingle();

    if (existingClaim) {
      return NextResponse.json(
        {
          error: `You have already claimed the profile for ${(existingClaim as { name: string }).name}. Each user can claim one artist profile.`,
        },
        { status: 409 }
      );
    }

    // Claim the profile
    const { error: updateError } = await serviceClient
      .from("artists")
      .update({
        claimed_by: user.id,
        claimed_at: new Date().toISOString(),
      } as never)
      .eq("id", artist_id);

    if (updateError) {
      return errorResponse(updateError, "POST /api/artists/claim (update)");
    }

    return NextResponse.json({
      success: true,
      message: `You've claimed the profile for ${artistData.name}. An admin will review for verification.`,
    });
  } catch (error) {
    return errorResponse(error, "POST /api/artists/claim");
  }
}
