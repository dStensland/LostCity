import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// POST /api/auth/check-username
// Check if a username is available and optionally reserve it
export async function POST(request: NextRequest) {
  // Apply stricter rate limiting to prevent username enumeration
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.auth, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const { username, reserve } = await request.json();

    // Validate username format
    if (!username || typeof username !== "string") {
      return NextResponse.json(
        { available: false, error: "Username is required" },
        { status: 400 }
      );
    }

    const normalizedUsername = username.toLowerCase().trim();

    // Validate username format (3-30 chars, lowercase alphanumeric and underscores)
    if (!/^[a-z0-9_]{3,30}$/.test(normalizedUsername)) {
      return NextResponse.json(
        {
          available: false,
          error:
            "Username must be 3-30 characters, lowercase letters, numbers, and underscores only",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if username exists in profiles
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", normalizedUsername)
      .maybeSingle();

    if (existingProfile) {
      // Use generic message to prevent username enumeration
      return NextResponse.json({ available: false, error: "Username is not available" });
    }

    // Check if username is reserved (if reservations table exists)
    // Note: Type assertion used since table isn't in generated types until migration runs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingReservation } = await (supabase as any)
      .from("username_reservations")
      .select("id, expires_at")
      .eq("username", normalizedUsername)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (existingReservation) {
      // Use same generic message for consistency
      return NextResponse.json({
        available: false,
        error: "Username is not available",
      });
    }

    // If reserve is true, create a reservation
    if (reserve) {
      // Clean up expired reservations first
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("username_reservations")
        .delete()
        .lt("expires_at", new Date().toISOString());

      // Create new reservation (5 minute TTL)
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: reservation, error: reserveError } = await (supabase as any)
        .from("username_reservations")
        .insert({
          username: normalizedUsername,
          expires_at: expiresAt,
        })
        .select("id")
        .maybeSingle();

      if (reserveError) {
        // If unique constraint error, username was just taken/reserved
        if (reserveError.code === "23505") {
          return NextResponse.json({
            available: false,
            error: "Username is not available",
          });
        }
        logger.error("Error reserving username", reserveError, { username: normalizedUsername, component: "auth/check-username" });
        // Don't fail the check - just return available without reservation
        return NextResponse.json({ available: true, reservation_id: null });
      }

      return NextResponse.json({
        available: true,
        reservation_id: reservation?.id,
      });
    }

    return NextResponse.json({ available: true });
  } catch (error) {
    logger.error("Error checking username", error, { component: "auth/check-username" });
    return NextResponse.json(
      { available: false, error: "Failed to check username" },
      { status: 500 }
    );
  }
}
