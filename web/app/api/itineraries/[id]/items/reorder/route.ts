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

// PATCH /api/itineraries/[id]/items/reorder — reorder items by position
export const PATCH = withAuthAndParams<Params>(
  async (request, { user, serviceClient, params }) => {
    const rateLimitResult = await applyRateLimit(
      request,
      RATE_LIMITS.write,
      getClientIdentifier(request)
    );
    if (rateLimitResult) return rateLimitResult;

    const sizeCheck = checkBodySize(request, 8192);
    if (sizeCheck) return sizeCheck;

    if (!isValidUUID(params.id)) {
      return validationError("Invalid itinerary ID");
    }

    let body: { item_ids?: unknown };
    try {
      body = (await request.json()) as { item_ids?: unknown };
    } catch {
      return validationError("Invalid JSON body");
    }

    if (
      !Array.isArray(body.item_ids) ||
      body.item_ids.length === 0 ||
      body.item_ids.length > 50
    ) {
      return validationError("item_ids must be a non-empty array (max 50)");
    }

    // Validate all are UUIDs
    for (const id of body.item_ids) {
      if (!isValidUUID(id)) {
        return validationError("All item_ids must be valid UUIDs");
      }
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

    // Update positions in order
    const itemIds = body.item_ids as string[];
    const updates = itemIds.map((itemId, index) =>
      serviceClient
        .from("itinerary_items")
        .update({ position: index } as never)
        .eq("id", itemId)
        .eq("itinerary_id", params.id)
    );

    const results = await Promise.all(updates);
    const failed = results.some((r) => r.error);

    if (failed) {
      console.error("Error reordering items");
      return errorApiResponse("Failed to reorder items", 500);
    }

    // Update itinerary timestamp
    await serviceClient
      .from("itineraries")
      .update({ updated_at: new Date().toISOString() } as never)
      .eq("id", params.id);

    return successResponse({ success: true });
  }
);
