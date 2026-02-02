import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { isValidString, isValidUrl, validationError } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

/**
 * GET /api/auth/profile
 *
 * Fetches the current user's profile, creating one if it doesn't exist.
 * This is the single source of truth for profile data and ensures
 * users always have a profile before doing authenticated operations.
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting to prevent abuse
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.auth, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized", profile: null }, { status: 401 });
    }

    // Use service client for reliable database access
    const serviceClient = createServiceClient();

    // Try to fetch existing profile
    const { data: existingProfile, error: fetchError } = await serviceClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    let profile = existingProfile;

    if (fetchError) {
      logger.error("Error fetching profile", fetchError, { userId: user.id, component: "auth/profile" });
      return NextResponse.json(
        { error: "Failed to fetch profile", profile: null },
        { status: 500 }
      );
    }

    // If no profile exists, create one
    if (!profile) {
      logger.info("Creating missing profile", { userId: user.id, component: "auth/profile" });

      // Generate username from email or metadata
      let baseUsername =
        user.user_metadata?.username ||
        user.email?.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "") ||
        "user";

      // Ensure minimum length
      if (baseUsername.length < 3) {
        baseUsername = `user_${user.id.substring(0, 8)}`;
      }

      // Truncate and find unique username
      baseUsername = baseUsername.substring(0, 20);
      let username = baseUsername;
      let suffix = 0;

      // Check for uniqueness
      while (true) {
        const { data: existing } = await serviceClient
          .from("profiles")
          .select("id")
          .eq("username", username)
          .maybeSingle();

        if (!existing) break;
        suffix++;
        username = `${baseUsername}${suffix}`;
      }

      // Create the profile
      const { data: newProfile, error: createError } = await serviceClient
        .from("profiles")
        .insert({
          id: user.id,
          username,
          display_name: user.user_metadata?.full_name || null,
          avatar_url: user.user_metadata?.avatar_url || null,
          is_public: true,
        } as never)
        .select()
        .single();

      if (createError) {
        logger.error("Error creating profile", createError, { userId: user.id, username, component: "auth/profile" });
        // Try to fetch again in case of race condition
        const { data: retryProfile } = await serviceClient
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (retryProfile) {
          profile = retryProfile;
        } else {
          return NextResponse.json(
            { error: "Failed to create profile", profile: null },
            { status: 500 }
          );
        }
      } else {
        profile = newProfile;
      }

      // Also ensure user_preferences exists
      await serviceClient
        .from("user_preferences")
        .insert({ user_id: user.id } as never)
        .select()
        .maybeSingle();
    }

    return NextResponse.json({ profile });
  } catch (error) {
    logger.error("Profile API error", error, { component: "auth/profile" });
    return NextResponse.json(
      { error: "Internal server error", profile: null },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/auth/profile
 *
 * Updates the current user's profile.
 */
export async function PATCH(request: NextRequest) {
  // Apply rate limiting to prevent abuse
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
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
    const { display_name, bio, location, website, is_public } = body;

    // Validate input fields to prevent DoS and XSS
    if (display_name !== undefined && !isValidString(display_name, 0, 100)) {
      return validationError("Display name must be 100 characters or less");
    }
    if (bio !== undefined && !isValidString(bio, 0, 500)) {
      return validationError("Bio must be 500 characters or less");
    }
    if (location !== undefined && !isValidString(location, 0, 100)) {
      return validationError("Location must be 100 characters or less");
    }
    if (website !== undefined && website) {
      if (!isValidString(website, 0, 200)) {
        return validationError("Website URL must be 200 characters or less");
      }
      if (!isValidUrl(website)) {
        return validationError("Invalid website URL");
      }
    }

    // Use service client for reliable database access
    const serviceClient = createServiceClient();

    const { data: profile, error } = await serviceClient
      .from("profiles")
      .update({
        ...(display_name !== undefined && { display_name }),
        ...(bio !== undefined && { bio }),
        ...(location !== undefined && { location }),
        ...(website !== undefined && { website }),
        ...(is_public !== undefined && { is_public }),
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      logger.error("Error updating profile", error, { userId: user.id, component: "auth/profile" });
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    logger.error("Profile update API error", error, { component: "auth/profile" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
