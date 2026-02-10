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
}

type Props = {
  params: Promise<{ slug: string }>;
};

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
    .select("id, claimed_by, is_verified")
    .eq("slug", slug)
    .maybeSingle() as {
      data: {
        id: number;
        claimed_by: string | null;
        is_verified: boolean | null;
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
