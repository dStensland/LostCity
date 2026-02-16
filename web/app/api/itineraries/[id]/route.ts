import { withAuthAndParams } from "@/lib/api-middleware";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import {
  checkBodySize,
  isValidString,
  isValidUUID,
  successResponse,
  errorApiResponse,
  validationError,
} from "@/lib/api-utils";
import { NextResponse } from "next/server";

type Params = { id: string };

// GET /api/itineraries/[id] — fetch itinerary with items
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

    const { data: itinerary, error } = await serviceClient
      .from("itineraries")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching itinerary:", error.message);
      return errorApiResponse("Failed to fetch itinerary", 500);
    }

    if (!itinerary) {
      return errorApiResponse("Itinerary not found", 404);
    }

    // Fetch items with joined event/venue data
    const { data: items } = await serviceClient
      .from("itinerary_items")
      .select(
        `
        *,
        event:events(id, title, start_date, start_time, image_url, category, lat, lng),
        venue:venues(id, slug, name, image_url, neighborhood, venue_type, lat, lng)
      `
      )
      .eq("itinerary_id", params.id)
      .order("position", { ascending: true });

    return successResponse({
      itinerary: { ...itinerary, items: items || [] },
    });
  }
);

// PATCH /api/itineraries/[id] — update itinerary metadata
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

    if (!isValidUUID(params.id)) {
      return validationError("Invalid itinerary ID");
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return validationError("Invalid JSON body");
    }

    // Verify ownership
    const { data: existing } = await serviceClient
      .from("itineraries")
      .select("id")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) {
      return errorApiResponse("Itinerary not found", 404);
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.title === "string" && isValidString(body.title, 1, 200)) {
      updates.title = body.title;
    }
    if (
      typeof body.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(body.date)
    ) {
      updates.date = body.date;
    }
    if (body.date === null) {
      updates.date = null;
    }
    if (
      typeof body.description === "string" &&
      isValidString(body.description, 0, 1000)
    ) {
      updates.description = body.description;
    }
    if (typeof body.is_public === "boolean") {
      updates.is_public = body.is_public;
    }

    const { data: itinerary, error } = await serviceClient
      .from("itineraries")
      .update(updates as never)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating itinerary:", error.message);
      return errorApiResponse("Failed to update itinerary", 500);
    }

    return successResponse({ itinerary });
  }
);

// DELETE /api/itineraries/[id]
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

    const { error } = await serviceClient
      .from("itineraries")
      .delete()
      .eq("id", params.id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting itinerary:", error.message);
      return errorApiResponse("Failed to delete itinerary", 500);
    }

    return new NextResponse(null, { status: 204 });
  }
);
