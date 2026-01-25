import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import type { OnboardingMood, OnboardingAction } from "@/lib/types";

type EventWithCategory = {
  category: string | null;
};

type EventWithVenue = {
  category: string | null;
  venue: {
    neighborhood: string | null;
  } | null;
};

interface OnboardingCompleteRequest {
  mood: OnboardingMood | null;
  likedEventIds: number[];
  selectedNeighborhoods: string[];
  followedProducerIds: number[];
  interactions: Array<{
    step: string;
    event_id?: number;
    action: OnboardingAction;
  }>;
}

export async function POST(request: Request) {
  const rateLimitResult = applyRateLimit(request, RATE_LIMITS.write);
  if (rateLimitResult) return rateLimitResult;

  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: OnboardingCompleteRequest = await request.json();
    const { mood, likedEventIds, selectedNeighborhoods, followedProducerIds, interactions } = body;

    // Get categories from liked events for preference inference
    let inferredCategories: string[] = [];
    if (likedEventIds.length > 0) {
      const { data: likedEvents } = await supabase
        .from("events")
        .select("category")
        .in("id", likedEventIds);

      if (likedEvents) {
        const events = likedEvents as EventWithCategory[];
        inferredCategories = [...new Set(events.map((e) => e.category).filter(Boolean))] as string[];
      }
    }

    // Update user preferences with onboarding data
    const prefsData = {
      user_id: user.id,
      onboarding_mood: mood,
      onboarding_completed_at: new Date().toISOString(),
      // Set neighborhoods if selected
      ...(selectedNeighborhoods.length > 0 && {
        favorite_neighborhoods: selectedNeighborhoods,
      }),
      // Set inferred categories from liked events
      ...(inferredCategories.length > 0 && {
        favorite_categories: inferredCategories,
      }),
    };
    const { error: prefsError } = await supabase
      .from("user_preferences")
      .upsert(prefsData as never, { onConflict: "user_id" });

    if (prefsError) {
      console.error("Preferences update error:", prefsError);
      // Don't fail the whole request - continue with other saves
    }

    // Save liked events to saved_items
    if (likedEventIds.length > 0) {
      const savedItems = likedEventIds.map((eventId) => ({
        user_id: user.id,
        event_id: eventId,
      }));

      const { error: saveError } = await supabase
        .from("saved_items")
        .upsert(savedItems as never, { onConflict: "user_id,event_id", ignoreDuplicates: true });

      if (saveError) {
        console.error("Saved items error:", saveError);
      }
    }

    // Follow selected producers
    if (followedProducerIds.length > 0) {
      const follows = followedProducerIds.map((producerId) => ({
        follower_id: user.id,
        followed_producer_id: producerId,
      }));

      const { error: followError } = await supabase
        .from("follows")
        .upsert(follows as never, { onConflict: "follower_id,followed_producer_id", ignoreDuplicates: true });

      if (followError) {
        console.error("Follows error:", followError);
      }
    }

    // Track onboarding interactions for analytics
    if (interactions.length > 0) {
      const interactionRecords = interactions.map((i) => ({
        user_id: user.id,
        step: i.step,
        event_id: i.event_id || null,
        action: i.action,
      }));

      const { error: interactionError } = await supabase
        .from("onboarding_interactions")
        .insert(interactionRecords as never);

      if (interactionError) {
        console.error("Interaction tracking error:", interactionError);
      }
    }

    // Track signals for liked events to improve future recommendations
    if (likedEventIds.length > 0) {
      // Track as "onboarding_like" action with score of 6 (between view and save)
      for (const eventId of likedEventIds) {
        try {
          const { data: eventData } = await supabase
            .from("events")
            .select("category, venue:venues!events_venue_id_fkey(neighborhood)")
            .eq("id", eventId)
            .single();

          const event = eventData as EventWithVenue | null;
          if (event) {
            // Track category signal
            if (event.category) {
              await supabase.from("inferred_preferences").upsert(
                {
                  user_id: user.id,
                  signal_type: "category",
                  signal_value: event.category,
                  score: 6,
                  interaction_count: 1,
                } as never,
                { onConflict: "user_id,signal_type,signal_value" }
              );
            }

            // Track neighborhood signal
            if (event.venue?.neighborhood) {
              await supabase.from("inferred_preferences").upsert(
                {
                  user_id: user.id,
                  signal_type: "neighborhood",
                  signal_value: event.venue.neighborhood,
                  score: 6,
                  interaction_count: 1,
                } as never,
                { onConflict: "user_id,signal_type,signal_value" }
              );
            }
          }
        } catch (signalError) {
          console.error("Signal tracking error:", signalError);
        }
      }
    }

    return Response.json({
      success: true,
      savedEventCount: likedEventIds.length,
      followedProducerCount: followedProducerIds.length,
      neighborhoodCount: selectedNeighborhoods.length,
    });
  } catch (error) {
    console.error("Onboarding complete API error:", error);
    return Response.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}
