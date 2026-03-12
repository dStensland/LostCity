import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import type { AnySupabase } from "@/lib/api-utils";
import type { PublicProfile } from "@/lib/types/profile";

type RouteContext = {
  params: Promise<{ username: string }>;
};

/**
 * GET /api/profile/[username]
 *
 * Returns a privacy-filtered public profile via the get_public_profile RPC.
 * The RPC handles all field gating (privacy tiers, friend status, blocks).
 * Returns 404 when the profile doesn't exist or the viewer is blocked.
 *
 * The legacy ?section= pattern (upcoming|venues|taste) is intentionally
 * dropped here — those queries were independent of public profile data and
 * will live at separate endpoints if/when resurfaced.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const { username } = await context.params;

    // Attempt to get the current viewer's ID (null for unauthenticated visitors)
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Cast to AnySupabase to call an RPC not yet in generated types
    const serviceClient = createServiceClient() as unknown as AnySupabase;

    const { data, error } = await serviceClient.rpc("get_public_profile", {
      p_username: username,
      p_viewer_id: user?.id ?? null,
    });

    if (error) {
      logger.error("get_public_profile RPC error", error, {
        component: "profile/[username]",
        username,
      });
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // RPC returns NULL when the profile doesn't exist or the viewer is blocked
    if (!data) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const profile = data as PublicProfile;

    return NextResponse.json(
      { profile },
      {
        headers: {
          // Short-lived cache: profiles can change and privacy gates must stay accurate.
          // Allow CDN to cache non-authenticated views briefly; vary on Authorization
          // so cached responses are not served across user sessions.
          "Cache-Control": "private, max-age=30",
        },
      }
    );
  } catch (error) {
    logger.error("Profile GET error", error, { component: "profile/[username]" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
