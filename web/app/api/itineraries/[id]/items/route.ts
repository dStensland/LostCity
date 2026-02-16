import { withAuthAndParams } from "@/lib/api-middleware";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import {
  checkBodySize,
  isValidEnum,
  isValidString,
  isValidUUID,
  parseIntParam,
  createdResponse,
  errorApiResponse,
  validationError,
} from "@/lib/api-utils";
import {
  haversineDistanceMeters,
  estimateWalkMinutes,
} from "@/lib/itinerary-utils";

type Params = { id: string };

const VALID_ITEM_TYPES = ["event", "venue", "custom"] as const;

// POST /api/itineraries/[id]/items — add an item to an itinerary
export const POST = withAuthAndParams<Params>(
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

    if (!isValidEnum(body.item_type, VALID_ITEM_TYPES)) {
      return validationError("item_type must be event, venue, or custom");
    }

    // Verify ownership
    const { data: itinerary } = await serviceClient
      .from("itineraries")
      .select("id, user_id")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!itinerary) {
      return errorApiResponse("Itinerary not found", 404);
    }

    // Get the next position
    const { data: existingItems } = await serviceClient
      .from("itinerary_items")
      .select("id, position, event:events(lat, lng), venue:venues(lat, lng), custom_lat, custom_lng")
      .eq("itinerary_id", params.id)
      .order("position", { ascending: false })
      .limit(1);

    const nextPosition =
      existingItems && existingItems.length > 0
        ? (existingItems[0] as { position: number }).position + 1
        : 0;

    // Validate type-specific fields
    let eventId: number | null = null;
    let venueId: number | null = null;
    let newItemLat: number | null = null;
    let newItemLng: number | null = null;

    if (body.item_type === "event") {
      eventId = parseIntParam(String(body.event_id));
      if (!eventId) return validationError("event_id is required for event items");

      // Fetch event coords
      const { data: event } = await serviceClient
        .from("events")
        .select("id, lat, lng")
        .eq("id", eventId)
        .maybeSingle();

      if (!event) return errorApiResponse("Event not found", 404);
      const eventData = event as { id: number; lat: number | null; lng: number | null };
      newItemLat = eventData.lat;
      newItemLng = eventData.lng;
    } else if (body.item_type === "venue") {
      venueId = parseIntParam(String(body.venue_id));
      if (!venueId) return validationError("venue_id is required for venue items");

      const { data: venue } = await serviceClient
        .from("venues")
        .select("id, lat, lng")
        .eq("id", venueId)
        .maybeSingle();

      if (!venue) return errorApiResponse("Venue not found", 404);
      const venueData = venue as { id: number; lat: number | null; lng: number | null };
      newItemLat = venueData.lat;
      newItemLng = venueData.lng;
    } else {
      // Custom item
      if (!isValidString(body.custom_title, 1, 200)) {
        return validationError("custom_title is required for custom items");
      }
      if (typeof body.custom_lat === "number") newItemLat = body.custom_lat;
      if (typeof body.custom_lng === "number") newItemLng = body.custom_lng;
    }

    // Calculate walk time from previous item
    let walkDistanceMeters: number | null = null;
    let walkTimeMinutes: number | null = null;

    if (
      existingItems &&
      existingItems.length > 0 &&
      newItemLat != null &&
      newItemLng != null
    ) {
      const prev = existingItems[0] as unknown as {
        event: { lat: number | null; lng: number | null } | null;
        venue: { lat: number | null; lng: number | null } | null;
        custom_lat: number | null;
        custom_lng: number | null;
      };

      let prevLat: number | null = null;
      let prevLng: number | null = null;

      if (prev.custom_lat != null && prev.custom_lng != null) {
        prevLat = prev.custom_lat;
        prevLng = prev.custom_lng;
      } else if (prev.event?.lat != null && prev.event?.lng != null) {
        prevLat = prev.event.lat;
        prevLng = prev.event.lng;
      } else if (prev.venue?.lat != null && prev.venue?.lng != null) {
        prevLat = prev.venue.lat;
        prevLng = prev.venue.lng;
      }

      if (prevLat != null && prevLng != null) {
        walkDistanceMeters = Math.round(
          haversineDistanceMeters(prevLat, prevLng, newItemLat, newItemLng)
        );
        walkTimeMinutes = estimateWalkMinutes(walkDistanceMeters);
      }
    }

    const insertData = {
      itinerary_id: params.id,
      item_type: body.item_type,
      event_id: eventId,
      venue_id: venueId,
      custom_title:
        typeof body.custom_title === "string"
          ? body.custom_title.slice(0, 200)
          : null,
      custom_description:
        typeof body.custom_description === "string"
          ? body.custom_description.slice(0, 500)
          : null,
      custom_address:
        typeof body.custom_address === "string"
          ? body.custom_address.slice(0, 300)
          : null,
      custom_lat: body.item_type === "custom" ? newItemLat : null,
      custom_lng: body.item_type === "custom" ? newItemLng : null,
      position: nextPosition,
      start_time:
        typeof body.start_time === "string" &&
        /^\d{2}:\d{2}$/.test(body.start_time)
          ? body.start_time
          : null,
      duration_minutes:
        typeof body.duration_minutes === "number" &&
        body.duration_minutes > 0 &&
        body.duration_minutes <= 480
          ? body.duration_minutes
          : 60,
      walk_distance_meters: walkDistanceMeters,
      walk_time_minutes: walkTimeMinutes,
      notes:
        typeof body.notes === "string"
          ? body.notes.slice(0, 500)
          : null,
    };

    const { data: item, error } = await serviceClient
      .from("itinerary_items")
      .insert(insertData as never)
      .select(
        `
        *,
        event:events(id, title, start_date, start_time, image_url, category, lat, lng),
        venue:venues(id, slug, name, image_url, neighborhood, venue_type, lat, lng)
      `
      )
      .single();

    if (error) {
      console.error("Error adding itinerary item:", error.message);
      return errorApiResponse("Failed to add item", 500);
    }

    // Update itinerary's updated_at
    await serviceClient
      .from("itineraries")
      .update({ updated_at: new Date().toISOString() } as never)
      .eq("id", params.id);

    return createdResponse({ item });
  }
);
