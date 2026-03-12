import { withAuthAndParams } from "@/lib/api-middleware";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import {
  checkBodySize,
  isValidUUID,
  successResponse,
  errorApiResponse,
  validationError,
} from "@/lib/api-utils";

type Params = { id: string; participantId: string };

// PATCH /api/itineraries/[id]/participants/[participantId]/stops
// Update per-stop availability: { item_id, status, arrival_time?, note? }
export const PATCH = withAuthAndParams<Params>(
  async (request, { user, serviceClient, params }) => {
    const rateLimitResult = await applyRateLimit(
      request,
      RATE_LIMITS.write,
      getClientIdentifier(request)
    );
    if (rateLimitResult) return rateLimitResult;

    const sizeCheck = checkBodySize(request, 4096);
    if (sizeCheck) return sizeCheck;

    if (!isValidUUID(params.id) || !isValidUUID(params.participantId)) {
      return validationError("Invalid ID");
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return validationError("Invalid JSON body");
    }

    // Verify the participant belongs to this user
    const { data: participant } = await serviceClient
      .from("itinerary_participants")
      .select("id, user_id, itinerary_id")
      .eq("id", params.participantId)
      .eq("itinerary_id", params.id)
      .maybeSingle();

    if (!participant) {
      return errorApiResponse("Participant not found", 404);
    }

    if (participant.user_id !== user.id) {
      return errorApiResponse("Can only update your own stops", 403);
    }

    // Handle RSVP status update if included
    if (body.rsvp_status) {
      const validStatuses = ["going", "cant_go"];
      if (!validStatuses.includes(body.rsvp_status as string)) {
        return validationError("rsvp_status must be 'going' or 'cant_go'");
      }

      await serviceClient
        .from("itinerary_participants")
        .update({
          rsvp_status: body.rsvp_status,
          responded_at: new Date().toISOString(),
        } as never)
        .eq("id", params.participantId);

      // Notify organizer of RSVP change (if not self)
      const { data: itinerary } = await serviceClient
        .from("itineraries")
        .select("user_id")
        .eq("id", params.id)
        .maybeSingle();

      if (itinerary) {
        const owner = itinerary as { user_id: string };
        if (owner.user_id !== user.id) {
          await serviceClient.from("notifications").insert({
            user_id: owner.user_id,
            type: "plan_rsvp_change",
            actor_id: user.id,
            itinerary_id: params.id,
          } as never);
        }
      }
    }

    // Handle per-stop updates
    const stops = body.stops as Array<{
      item_id: string;
      status: string;
      arrival_time?: string;
      note?: string;
    }> | undefined;

    if (stops && Array.isArray(stops)) {
      for (const stop of stops) {
        if (!isValidUUID(stop.item_id)) continue;
        if (!["joining", "skipping"].includes(stop.status)) continue;

        // Verify item belongs to this itinerary
        const { data: item } = await serviceClient
          .from("itinerary_items")
          .select("id")
          .eq("id", stop.item_id)
          .eq("itinerary_id", params.id)
          .maybeSingle();

        if (!item) continue;

        // Upsert the stop availability
        await serviceClient
          .from("itinerary_participant_stops")
          .upsert(
            {
              participant_id: params.participantId,
              item_id: stop.item_id,
              status: stop.status,
              arrival_time: stop.arrival_time || null,
              note: stop.note?.slice(0, 200) || null,
              updated_at: new Date().toISOString(),
            } as never,
            { onConflict: "participant_id,item_id" }
          );
      }
    }

    return successResponse({ success: true });
  }
);
