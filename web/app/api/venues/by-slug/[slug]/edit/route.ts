import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  errorApiResponse,
  validationError,
  successResponse,
  isValidString,
  isValidUrl,
  isValidStringArray,
  sanitizeString,
  checkBodySize,
} from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const PLANNING_SERVICE_STYLES = [
  "quick_service",
  "casual_dine_in",
  "full_service",
  "tasting_menu",
  "bar_food",
  "coffee_dessert",
] as const;

function parseNullableBoundedInt(
  value: unknown,
  fieldName: string,
  min: number,
  max: number
): { value: number | null; error: string | null } {
  if (value === null || value === "") return { value: null, error: null };
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { value: null, error: `${fieldName} must be an integer` };
  }
  if (value < min || value > max) {
    return {
      value: null,
      error: `${fieldName} must be between ${min} and ${max}`,
    };
  }
  return { value, error: null };
}

interface EditVenueBody {
  description?: string;
  website?: string;
  hours?: string;
  image_url?: string;
  accessibility_notes?: string;
  vibes?: string[];
  phone?: string;
  menu_url?: string;
  reservation_url?: string;
  service_style?: (typeof PLANNING_SERVICE_STYLES)[number] | null;
  meal_duration_min_minutes?: number | null;
  meal_duration_max_minutes?: number | null;
  walk_in_wait_minutes?: number | null;
  payment_buffer_minutes?: number | null;
  accepts_reservations?: boolean | null;
  reservation_recommended?: boolean | null;
  planning_notes?: string | null;
}

type Props = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorApiResponse("Authentication required", 401);
  }

  const { slug } = await params;
  if (!isValidString(slug, 1, 200)) {
    return validationError("Invalid venue slug");
  }

  const serviceClient = createServiceClient();
  const { data: venue, error: venueError } = await serviceClient
    .from("venues")
    .select(
      "id, name, slug, claimed_by, is_verified, description, website, hours, image_url, accessibility_notes, vibes, phone, menu_url, reservation_url, service_style, meal_duration_min_minutes, meal_duration_max_minutes, walk_in_wait_minutes, payment_buffer_minutes, accepts_reservations, reservation_recommended, planning_notes, planning_last_verified_at"
    )
    .eq("slug", slug)
    .maybeSingle() as {
      data: {
        id: number;
        name: string;
        slug: string;
        claimed_by: string | null;
        is_verified: boolean | null;
        description: string | null;
        website: string | null;
        hours: string | null;
        image_url: string | null;
        accessibility_notes: string | null;
        vibes: string[] | null;
        phone: string | null;
        menu_url: string | null;
        reservation_url: string | null;
        service_style: (typeof PLANNING_SERVICE_STYLES)[number] | null;
        meal_duration_min_minutes: number | null;
        meal_duration_max_minutes: number | null;
        walk_in_wait_minutes: number | null;
        payment_buffer_minutes: number | null;
        accepts_reservations: boolean | null;
        reservation_recommended: boolean | null;
        planning_notes: string | null;
        planning_last_verified_at: string | null;
      } | null;
      error: unknown;
    };

  if (venueError) {
    console.error("Error fetching venue:", venueError);
    return errorApiResponse("Failed to fetch venue", 500);
  }

  if (!venue) {
    return errorApiResponse("Venue not found", 404);
  }

  if (venue.claimed_by !== user.id) {
    return errorApiResponse("You do not have permission to view this venue", 403);
  }

  return successResponse({
    venue: {
      ...venue,
      hours_display: venue.hours,
    },
  });
}

export async function PATCH(request: NextRequest, { params }: Props) {
  // Rate limiting
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  // Check body size
  const bodySizeCheck = checkBodySize(request, 50000); // Allow larger for descriptions
  if (bodySizeCheck) return bodySizeCheck;

  // Verify authentication
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorApiResponse("Authentication required", 401);
  }

  const { slug } = await params;

  if (!isValidString(slug, 1, 200)) {
    return validationError("Invalid venue slug");
  }

  // Use service client for database operations
  const serviceClient = createServiceClient();

  // Get venue and verify ownership
  const { data: venue, error: venueError } = await serviceClient
    .from("venues")
    .select("id, claimed_by, is_verified, meal_duration_min_minutes, meal_duration_max_minutes")
    .eq("slug", slug)
    .maybeSingle() as {
      data: {
        id: number;
        claimed_by: string | null;
        is_verified: boolean | null;
        meal_duration_min_minutes: number | null;
        meal_duration_max_minutes: number | null;
      } | null;
      error: unknown;
    };

  if (venueError) {
    console.error("Error fetching venue:", venueError);
    return errorApiResponse("Failed to fetch venue", 500);
  }

  if (!venue) {
    return errorApiResponse("Venue not found", 404);
  }

  // Verify user owns this venue
  if (venue.claimed_by !== user.id) {
    return errorApiResponse("You do not have permission to edit this venue", 403);
  }

  // Parse request body
  let body: EditVenueBody;
  try {
    body = await request.json();
  } catch {
    return validationError("Invalid JSON in request body");
  }

  // Validate fields
  const updates: Record<string, unknown> = {};

  if (body.description !== undefined) {
    if (!isValidString(body.description, 0, 5000)) {
      return validationError("Description must be between 0 and 5000 characters");
    }
    updates.description = sanitizeString(body.description);
  }

  if (body.website !== undefined) {
    if (body.website && !isValidUrl(body.website)) {
      return validationError("Invalid website URL");
    }
    updates.website = body.website || null;
  }

  if (body.hours !== undefined) {
    if (!isValidString(body.hours, 0, 500)) {
      return validationError("Hours must be between 0 and 500 characters");
    }
    updates.hours = sanitizeString(body.hours);
  }

  if (body.image_url !== undefined) {
    if (body.image_url && !isValidUrl(body.image_url)) {
      return validationError("Invalid image URL");
    }
    updates.image_url = body.image_url || null;
  }

  if (body.accessibility_notes !== undefined) {
    if (!isValidString(body.accessibility_notes, 0, 1000)) {
      return validationError("Accessibility notes must be between 0 and 1000 characters");
    }
    updates.accessibility_notes = sanitizeString(body.accessibility_notes);
  }

  if (body.vibes !== undefined) {
    if (!isValidStringArray(body.vibes, 20, 50)) {
      return validationError("Vibes must be an array of up to 20 strings");
    }
    updates.vibes = body.vibes;
  }

  if (body.phone !== undefined) {
    if (!isValidString(body.phone, 0, 20)) {
      return validationError("Phone must be between 0 and 20 characters");
    }
    updates.phone = sanitizeString(body.phone);
  }

  if (body.menu_url !== undefined) {
    if (body.menu_url && !isValidUrl(body.menu_url)) {
      return validationError("Invalid menu URL");
    }
    updates.menu_url = body.menu_url || null;
  }

  if (body.reservation_url !== undefined) {
    if (body.reservation_url && !isValidUrl(body.reservation_url)) {
      return validationError("Invalid reservation URL");
    }
    updates.reservation_url = body.reservation_url || null;
  }

  if (body.service_style !== undefined) {
    if (body.service_style === null || body.service_style === "") {
      updates.service_style = null;
    } else if (!PLANNING_SERVICE_STYLES.includes(body.service_style)) {
      return validationError(
        `service_style must be one of: ${PLANNING_SERVICE_STYLES.join(", ")}`
      );
    } else {
      updates.service_style = body.service_style;
    }
  }

  if (body.meal_duration_min_minutes !== undefined) {
    const parsed = parseNullableBoundedInt(
      body.meal_duration_min_minutes,
      "meal_duration_min_minutes",
      15,
      360
    );
    if (parsed.error) return validationError(parsed.error);
    updates.meal_duration_min_minutes = parsed.value;
  }

  if (body.meal_duration_max_minutes !== undefined) {
    const parsed = parseNullableBoundedInt(
      body.meal_duration_max_minutes,
      "meal_duration_max_minutes",
      15,
      480
    );
    if (parsed.error) return validationError(parsed.error);
    updates.meal_duration_max_minutes = parsed.value;
  }

  if (body.walk_in_wait_minutes !== undefined) {
    const parsed = parseNullableBoundedInt(
      body.walk_in_wait_minutes,
      "walk_in_wait_minutes",
      0,
      240
    );
    if (parsed.error) return validationError(parsed.error);
    updates.walk_in_wait_minutes = parsed.value;
  }

  if (body.payment_buffer_minutes !== undefined) {
    const parsed = parseNullableBoundedInt(
      body.payment_buffer_minutes,
      "payment_buffer_minutes",
      0,
      60
    );
    if (parsed.error) return validationError(parsed.error);
    updates.payment_buffer_minutes = parsed.value;
  }

  if (body.accepts_reservations !== undefined) {
    if (
      body.accepts_reservations !== null &&
      typeof body.accepts_reservations !== "boolean"
    ) {
      return validationError("accepts_reservations must be boolean or null");
    }
    updates.accepts_reservations = body.accepts_reservations;
  }

  if (body.reservation_recommended !== undefined) {
    if (
      body.reservation_recommended !== null &&
      typeof body.reservation_recommended !== "boolean"
    ) {
      return validationError("reservation_recommended must be boolean or null");
    }
    updates.reservation_recommended = body.reservation_recommended;
  }

  if (body.planning_notes !== undefined) {
    if (body.planning_notes !== null && !isValidString(body.planning_notes, 0, 1000)) {
      return validationError("planning_notes must be between 0 and 1000 characters");
    }
    updates.planning_notes = body.planning_notes ? sanitizeString(body.planning_notes) : null;
  }

  const nextMealDurationMin =
    updates.meal_duration_min_minutes !== undefined
      ? (updates.meal_duration_min_minutes as number | null)
      : venue.meal_duration_min_minutes;
  const nextMealDurationMax =
    updates.meal_duration_max_minutes !== undefined
      ? (updates.meal_duration_max_minutes as number | null)
      : venue.meal_duration_max_minutes;

  if (
    nextMealDurationMin != null &&
    nextMealDurationMax != null &&
    nextMealDurationMin > nextMealDurationMax
  ) {
    return validationError(
      "meal_duration_min_minutes cannot be greater than meal_duration_max_minutes"
    );
  }

  const planningFields = new Set([
    "service_style",
    "meal_duration_min_minutes",
    "meal_duration_max_minutes",
    "walk_in_wait_minutes",
    "payment_buffer_minutes",
    "accepts_reservations",
    "reservation_recommended",
    "planning_notes",
  ]);
  const touchedPlanningFields = Object.keys(updates).some((field) =>
    planningFields.has(field)
  );
  if (touchedPlanningFields) {
    updates.planning_last_verified_at = new Date().toISOString();
  }

  // If no updates, return early
  if (Object.keys(updates).length === 0) {
    return validationError("No valid fields to update");
  }

  // Update the venue
  const { data: updatedVenue, error: updateError } = await serviceClient
    .from("venues")
    .update(updates as never)
    .eq("id", venue.id)
    .select()
    .single();

  if (updateError) {
    console.error("Error updating venue:", updateError);
    return errorApiResponse("Failed to update venue", 500);
  }

  return successResponse({
    venue: updatedVenue,
    message: "Venue updated successfully",
  });
}
