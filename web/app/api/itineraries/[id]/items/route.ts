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

    // Get the next position (events don't have lat/lng — join through to venues)
    const { data: existingItems } = await serviceClient
      .from("itinerary_items")
      .select("id, position, event:events(venue:places(lat, lng)), venue:places(lat, lng), custom_lat, custom_lng")
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

      // Fetch event with venue coords (events don't have lat/lng — venues do)
      const { data: event, error: eventError } = await serviceClient
        .from("events")
        .select("id, venue:places(lat, lng)")
        .eq("id", eventId)
        .maybeSingle();

      if (eventError || !event) return errorApiResponse("Event not found", 404);
      const eventData = event as unknown as { id: number; venue: { lat: number | null; lng: number | null } | null };
      newItemLat = eventData.venue?.lat ?? null;
      newItemLng = eventData.venue?.lng ?? null;
    } else if (body.item_type === "venue") {
      venueId = parseIntParam(String(body.venue_id));
      if (!venueId) return validationError("venue_id is required for venue items");

      const { data: venue } = await serviceClient
        .from("places")
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
        event: { venue: { lat: number | null; lng: number | null } | null } | null;
        venue: { lat: number | null; lng: number | null } | null;
        custom_lat: number | null;
        custom_lng: number | null;
      };

      let prevLat: number | null = null;
      let prevLng: number | null = null;

      if (prev.custom_lat != null && prev.custom_lng != null) {
        prevLat = prev.custom_lat;
        prevLng = prev.custom_lng;
      } else if (prev.event?.venue?.lat != null && prev.event?.venue?.lng != null) {
        prevLat = prev.event.venue.lat;
        prevLng = prev.event.venue.lng;
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
        /^\d{2}:\d{2}(:\d{2})?$/.test(body.start_time)
          ? body.start_time.substring(0, 5)
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

    const { data: rawItem, error } = await serviceClient
      .from("itinerary_items")
      .insert(insertData as never)
      .select(
        `
        *,
        event:events(id, title, start_date, start_time, image_url, category:category_id, venue:places(name, lat, lng)),
        venue:places(id, slug, name, image_url, neighborhood, place_type, lat, lng)
      `
      )
      .single();

    if (error) {
      console.error("Error adding itinerary item:", error.message);
      return errorApiResponse("Failed to add item", 500);
    }

    // Flatten event.venue into event-level fields for frontend compatibility
    const item = (() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = rawItem as any;
      if (r?.event?.venue) {
        const { venue: eventVenue, ...eventRest } = r.event;
        return { ...r, event: { ...eventRest, lat: eventVenue.lat, lng: eventVenue.lng, venue_name: eventVenue.name } };
      }
      return r;
    })();

    // Update itinerary's updated_at
    await serviceClient
      .from("itineraries")
      .update({ updated_at: new Date().toISOString() } as never)
      .eq("id", params.id);

    return createdResponse({ item });
  }
);
