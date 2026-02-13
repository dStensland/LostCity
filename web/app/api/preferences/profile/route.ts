import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";

type UserPreferences = {
  favorite_categories: string[] | null;
  favorite_neighborhoods: string[] | null;
  favorite_vibes: string[] | null;
  price_preference: string | null;
};

type InferredPreference = {
  signal_type: string;
  signal_value: string;
  score: number;
  interaction_count: number;
};

type RsvpStat = {
  status: string;
};

export async function GET(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResult = await applyRateLimit(
      request,
      RATE_LIMITS.read,
      getClientIdentifier(request),
    );
    if (rateLimitResult) return rateLimitResult;

    const supabase = await createClient();

    // Get explicit preferences
    const { data: explicitPrefs } = (await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()) as { data: UserPreferences | null };

    // Get inferred preferences (top 20 by score)
    const { data: inferredPrefs } = (await supabase
      .from("inferred_preferences")
      .select("*")
      .eq("user_id", user.id)
      .order("score", { ascending: false })
      .limit(20)) as { data: InferredPreference[] | null };

    // Get follow counts
    const { count: venueFollowCount } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", user.id)
      .not("followed_venue_id", "is", null);

    const { count: organizationFollowCount } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", user.id)
      .not("followed_organization_id", "is", null);

    // Get RSVP stats
    const { data: rsvpStats } = (await supabase
      .from("event_rsvps")
      .select("status")
      .eq("user_id", user.id)) as { data: RsvpStat[] | null };

    const rsvpCounts = (rsvpStats || []).reduce(
      (acc, r) => {
        const status = r.status as string;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Calculate top categories from inferred preferences
    const categoryPrefs = (inferredPrefs || [])
      .filter((p) => p.signal_type === "category")
      .map((p) => ({
        category: p.signal_value,
        score: p.score,
        interactionCount: p.interaction_count,
      }));

    // Calculate top venues from inferred preferences
    const venuePrefs = (inferredPrefs || [])
      .filter((p) => p.signal_type === "venue")
      .slice(0, 5)
      .map((p) => ({
        venueId: p.signal_value.replace("venue:", ""),
        score: p.score,
        interactionCount: p.interaction_count,
      }));

    // Calculate neighborhood preferences
    const neighborhoodPrefs = (inferredPrefs || [])
      .filter((p) => p.signal_type === "neighborhood")
      .map((p) => ({
        neighborhood: p.signal_value,
        score: p.score,
        interactionCount: p.interaction_count,
      }));

    return NextResponse.json({
      explicit: {
        favorite_categories: explicitPrefs?.favorite_categories || [],
        favorite_neighborhoods: explicitPrefs?.favorite_neighborhoods || [],
        favorite_vibes: explicitPrefs?.favorite_vibes || [],
        price_preference: explicitPrefs?.price_preference || null,
      },
      inferred: inferredPrefs || [],
      stats: {
        topCategories: categoryPrefs,
        topVenues: venuePrefs,
        topNeighborhoods: neighborhoodPrefs,
        followedVenues: venueFollowCount || 0,
        // Keep both keys for backward compatibility while clients migrate.
        followedProducers: organizationFollowCount || 0,
        followedOrganizations: organizationFollowCount || 0,
        rsvps: {
          going: rsvpCounts["going"] || 0,
          interested: rsvpCounts["interested"] || 0,
          went: rsvpCounts["went"] || 0,
        },
      },
    });
  } catch (err) {
    return errorResponse(err, "GET /api/preferences/profile");
  }
}

// DELETE - Reset learned preferences
export async function DELETE(request: Request) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // Delete all inferred preferences for this user
    const { error } = await supabase
      .from("inferred_preferences")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      logger.error("Error resetting preferences", error);
      return NextResponse.json(
        { error: "Failed to reset preferences" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Learned preferences have been reset",
    });
  } catch (err) {
    return errorResponse(err, "DELETE /api/preferences/profile");
  }
}
