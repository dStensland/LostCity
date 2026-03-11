import { withAuthAndParams } from "@/lib/api-middleware";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import {
  isValidUUID,
  successResponse,
  errorApiResponse,
  validationError,
} from "@/lib/api-utils";

type Params = { id: string };

// POST /api/itineraries/[id]/join — self-service join (from share link)
// Requires auth. Adds the authenticated user as a participant with rsvp_status = 'going'.
export const POST = withAuthAndParams<Params>(
  async (request, { user, serviceClient, params }) => {
    const rateLimitResult = await applyRateLimit(
      request,
      RATE_LIMITS.write,
      getClientIdentifier(request)
    );
    if (rateLimitResult) return rateLimitResult;

    if (!isValidUUID(params.id)) {
      return validationError("Invalid itinerary ID");
    }

    // Verify itinerary exists and is shareable
    const { data: itinerary } = await serviceClient
      .from("itineraries")
      .select("id, user_id, visibility")
      .eq("id", params.id)
      .maybeSingle();

    if (!itinerary) {
      return errorApiResponse("Plan not found", 404);
    }

    const itin = itinerary as { id: string; user_id: string; visibility: string };

    // Must be public or invitees to join
    if (itin.visibility === "private") {
      return errorApiResponse("This plan is not accepting participants", 403);
    }

    // Can't join your own plan
    if (itin.user_id === user.id) {
      return validationError("You're the organizer of this plan");
    }

    // Check if already a participant
    const { data: existing } = await serviceClient
      .from("itinerary_participants")
      .select("id, rsvp_status")
      .eq("itinerary_id", params.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      const ex = existing as { id: string; rsvp_status: string };
      // If they previously declined, let them rejoin
      if (ex.rsvp_status === "cant_go") {
        await serviceClient
          .from("itinerary_participants")
          .update({
            rsvp_status: "going",
            responded_at: new Date().toISOString(),
          } as never)
          .eq("id", ex.id);

        // Notify organizer of rejoin
        await serviceClient.from("notifications").insert({
          user_id: itin.user_id,
          type: "plan_join",
          actor_id: user.id,
          itinerary_id: params.id,
        } as never);

        return successResponse({ participant_id: ex.id, rsvp_status: "going" });
      }
      // Already joined
      return successResponse({ participant_id: ex.id, rsvp_status: ex.rsvp_status });
    }

    // Insert as new participant
    const { data: participant, error } = await serviceClient
      .from("itinerary_participants")
      .insert({
        itinerary_id: params.id,
        user_id: user.id,
        invited_by: itin.user_id, // self-join shows organizer as inviter
        rsvp_status: "going",
        responded_at: new Date().toISOString(),
      } as never)
      .select("id")
      .single();

    if (error) {
      console.error("Error joining plan:", error.message);
      return errorApiResponse("Failed to join plan", 500);
    }

    const p = participant as { id: string };

    // Notify organizer of new join
    await serviceClient.from("notifications").insert({
      user_id: itin.user_id,
      type: "plan_join",
      actor_id: user.id,
      itinerary_id: params.id,
    } as never);

    return successResponse({ participant_id: p.id, rsvp_status: "going" });
  }
);
