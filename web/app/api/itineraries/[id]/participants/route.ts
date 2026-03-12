import { NextResponse } from "next/server";
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

type Params = { id: string };

// GET /api/itineraries/[id]/participants — list participants + per-stop availability
export const GET = withAuthAndParams<Params>(
  async (request, { user, serviceClient, params }) => {
    const rateLimitResult = await applyRateLimit(
      request,
      RATE_LIMITS.read,
      getClientIdentifier(request)
    );
    if (rateLimitResult) return rateLimitResult;

    if (!isValidUUID(params.id)) {
      return validationError("Invalid itinerary ID");
    }

    // Verify user is owner or participant
    const { data: itinerary } = await serviceClient
      .from("itineraries")
      .select("id, user_id")
      .eq("id", params.id)
      .maybeSingle();

    if (!itinerary) {
      return errorApiResponse("Itinerary not found", 404);
    }

    const isOwner = itinerary.user_id === user.id;
    if (!isOwner) {
      const { data: myParticipant } = await serviceClient
        .from("itinerary_participants")
        .select("id")
        .eq("itinerary_id", params.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!myParticipant) {
        return errorApiResponse("Not authorized", 403);
      }
    }

    // Use the RPC for full crew data
    const { data, error } = await serviceClient.rpc("get_itinerary_crew", {
      p_itinerary_id: params.id,
    } as never);

    if (error) {
      console.error("Error fetching participants:", error.message);
      return errorApiResponse("Failed to fetch participants", 500);
    }

    return successResponse(data);
  }
);

// POST /api/itineraries/[id]/participants — invite a friend
export const POST = withAuthAndParams<Params>(
  async (request, { user, serviceClient, params }) => {
    const rateLimitResult = await applyRateLimit(
      request,
      RATE_LIMITS.write,
      getClientIdentifier(request)
    );
    if (rateLimitResult) return rateLimitResult;

    const sizeCheck = checkBodySize(request, 2048);
    if (sizeCheck) return sizeCheck;

    if (!isValidUUID(params.id)) {
      return validationError("Invalid itinerary ID");
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return validationError("Invalid JSON body");
    }

    // Verify ownership — only owner can invite
    const { data: itinerary } = await serviceClient
      .from("itineraries")
      .select("id, user_id, visibility")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!itinerary) {
      return errorApiResponse("Itinerary not found or not owner", 404);
    }

    // Auto-upgrade visibility when first invite is sent
    if (itinerary.visibility === "private") {
      await serviceClient
        .from("itineraries")
        .update({ visibility: "invitees", updated_at: new Date().toISOString() } as never)
        .eq("id", params.id);
    }

    const userId = body.user_id as string | undefined;
    const contact = body.contact as string | undefined;

    if (!userId && !contact) {
      return validationError("Must provide user_id or contact");
    }
    if (userId && contact) {
      return validationError("Provide user_id or contact, not both");
    }
    if (userId && !isValidUUID(userId)) {
      return validationError("Invalid user_id");
    }

    // Don't let owner invite themselves
    if (userId === user.id) {
      return validationError("Cannot invite yourself");
    }

    const insertData = {
      itinerary_id: params.id,
      invited_by: user.id,
      ...(userId ? { user_id: userId } : { contact }),
    };

    const { data: participant, error } = await serviceClient
      .from("itinerary_participants")
      .insert(insertData as never)
      .select("id, user_id, contact, rsvp_status, invited_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return errorApiResponse("Already invited", 409);
      }
      console.error("Error inviting participant:", error.message);
      return errorApiResponse("Failed to invite", 500);
    }

    return NextResponse.json({ participant }, { status: 201 });
  }
);
