import { withAuthAndParams } from "@/lib/api-middleware";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import {
  isValidUUID,
  errorApiResponse,
  validationError,
} from "@/lib/api-utils";
import { NextResponse } from "next/server";

type Params = { id: string; itemId: string };

// DELETE /api/itineraries/[id]/items/[itemId] — remove an item from an itinerary
export const DELETE = withAuthAndParams<Params>(
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
    if (!isValidUUID(params.itemId)) {
      return validationError("Invalid item ID");
    }

    // Verify itinerary ownership
    const { data: itinerary } = await serviceClient
      .from("itineraries")
      .select("id")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!itinerary) {
      return errorApiResponse("Itinerary not found", 404);
    }

    // Delete the item
    const { error } = await serviceClient
      .from("itinerary_items")
      .delete()
      .eq("id", params.itemId)
      .eq("itinerary_id", params.id);

    if (error) {
      console.error("Error deleting itinerary item:", error.message);
      return errorApiResponse("Failed to delete item", 500);
    }

    // Update itinerary timestamp
    await serviceClient
      .from("itineraries")
      .update({ updated_at: new Date().toISOString() } as never)
      .eq("id", params.id);

    return new NextResponse(null, { status: 204 });
  }
);
