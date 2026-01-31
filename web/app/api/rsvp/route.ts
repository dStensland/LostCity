import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseIntParam, validationError } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

const VALID_STATUSES = ["going", "interested", "went"] as const;
const VALID_VISIBILITIES = ["friends", "public", "private"] as const;

/**
 * POST /api/rsvp
 * Create or update an RSVP
 */
export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { event_id, status, visibility = "friends" } = body;

    // Validate event_id is a number
    if (typeof event_id !== "number" || !Number.isInteger(event_id) || event_id <= 0) {
      return validationError("Invalid event_id");
    }

    if (!status || !VALID_STATUSES.includes(status)) {
      return validationError("Invalid status. Must be: going, interested, or went");
    }

    if (!VALID_VISIBILITIES.includes(visibility)) {
      return validationError("Invalid visibility. Must be: friends, public, or private");
    }

    // Use service client to bypass RLS
    const serviceClient = createServiceClient();

    // Ensure user has a profile (create if missing)
    const { data: existingProfile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!existingProfile) {
      // Create profile for user
      const username =
        user.user_metadata?.username ||
        user.email?.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "") ||
        `user_${user.id.substring(0, 8)}`;

      await serviceClient.from("profiles").insert({
        id: user.id,
        username: username.substring(0, 30),
        display_name: user.user_metadata?.full_name || null,
        avatar_url: user.user_metadata?.avatar_url || null,
      } as never);

      // Also create user_preferences
      await serviceClient.from("user_preferences").insert({
        user_id: user.id,
      } as never);
    }

    // Upsert the RSVP
    const { data, error } = await serviceClient
      .from("event_rsvps")
      .upsert(
        {
          user_id: user.id,
          event_id,
          status,
          visibility,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "user_id,event_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("RSVP upsert error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, rsvp: data });
  } catch (error) {
    console.error("RSVP API error:", error);
    return NextResponse.json(
      { error: "Failed to save RSVP" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rsvp
 * Remove an RSVP
 */
export async function DELETE(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = parseIntParam(searchParams.get("event_id"));

    if (eventId === null || eventId <= 0) {
      return validationError("Missing or invalid event_id");
    }

    // Use service client to bypass RLS
    const serviceClient = createServiceClient();

    const { error } = await serviceClient
      .from("event_rsvps")
      .delete()
      .eq("user_id", user.id)
      .eq("event_id", eventId);

    if (error) {
      console.error("RSVP delete error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("RSVP delete API error:", error);
    return NextResponse.json(
      { error: "Failed to remove RSVP" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/rsvp
 * Get user's RSVP for an event
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = parseIntParam(searchParams.get("event_id"));

    if (eventId === null || eventId <= 0) {
      return validationError("Missing or invalid event_id");
    }

    // Use service client to bypass RLS
    const serviceClient = createServiceClient();

    const { data, error } = await serviceClient
      .from("event_rsvps")
      .select("*")
      .eq("user_id", user.id)
      .eq("event_id", eventId)
      .maybeSingle();

    if (error) {
      console.error("RSVP fetch error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ rsvp: data });
  } catch (error) {
    console.error("RSVP get API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch RSVP" },
      { status: 500 }
    );
  }
}
