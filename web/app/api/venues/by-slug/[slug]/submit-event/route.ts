import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  errorApiResponse,
  validationError,
  createdResponse,
  isValidString,
  isValidUrl,
  sanitizeString,
  isValidEnum,
  checkBodySize,
} from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { getSiteUrl } from "@/lib/site-url";
import { getLocalDateString } from "@/lib/formats";

export const dynamic = "force-dynamic";

// Valid categories (should match your taxonomy)
const VALID_CATEGORIES = [
  "music",
  "nightlife",
  "food-drink",
  "arts",
  "sports",
  "community",
  "film",
  "theater",
  "comedy",
  "markets",
  "kids-family",
  "wellness",
  "learning",
  "outdoor",
  "tours",
] as const;

interface SubmitEventBody {
  title: string;
  start_date: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  description?: string;
  category: string;
  genre?: string;
  ticket_url?: string;
  image_url?: string;
  is_free?: boolean;
  price_min?: number;
  price_max?: number;
  price_note?: string;
}

type Props = {
  params: Promise<{ slug: string }>;
};

export async function POST(request: NextRequest, { params }: Props) {
  const siteUrl = getSiteUrl();

  // Rate limiting
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  // Check body size
  const bodySizeCheck = checkBodySize(request, 50000);
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
    .select("id, name, claimed_by, is_verified")
    .eq("slug", slug)
    .maybeSingle() as {
      data: {
        id: number;
        name: string;
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
    return errorApiResponse("You do not have permission to submit events for this venue", 403);
  }

  // Parse request body
  let body: SubmitEventBody;
  try {
    body = await request.json();
  } catch {
    return validationError("Invalid JSON in request body");
  }

  // Validate required fields
  if (!isValidString(body.title, 1, 500)) {
    return validationError("Title is required and must be between 1 and 500 characters");
  }

  if (!isValidString(body.start_date, 1, 20)) {
    return validationError("Start date is required");
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(body.start_date)) {
    return validationError("Start date must be in YYYY-MM-DD format");
  }

  // Validate future date using local YYYY-MM-DD to avoid UTC offset bugs.
  const startDate = new Date(body.start_date);
  if (body.start_date < getLocalDateString()) {
    return validationError("Start date must be in the future");
  }

  if (!isValidEnum(body.category, VALID_CATEGORIES)) {
    return validationError(
      `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`
    );
  }

  // Validate optional fields
  if (body.start_time && !isValidString(body.start_time, 1, 10)) {
    return validationError("Invalid start time");
  }

  // Validate time format (HH:MM or HH:MM:SS)
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
  if (body.start_time && !timeRegex.test(body.start_time)) {
    return validationError("Start time must be in HH:MM or HH:MM:SS format");
  }

  if (body.end_time && !timeRegex.test(body.end_time)) {
    return validationError("End time must be in HH:MM or HH:MM:SS format");
  }

  if (body.end_date) {
    if (!dateRegex.test(body.end_date)) {
      return validationError("End date must be in YYYY-MM-DD format");
    }
    const endDate = new Date(body.end_date);
    if (endDate < startDate) {
      return validationError("End date cannot be before start date");
    }
  }

  if (body.description && !isValidString(body.description, 0, 5000)) {
    return validationError("Description must be between 0 and 5000 characters");
  }

  if (body.genre && !isValidString(body.genre, 0, 100)) {
    return validationError("Genre must be between 0 and 100 characters");
  }

  if (body.ticket_url && !isValidUrl(body.ticket_url)) {
    return validationError("Invalid ticket URL");
  }

  if (body.image_url && !isValidUrl(body.image_url)) {
    return validationError("Invalid image URL");
  }

  if (body.price_note && !isValidString(body.price_note, 0, 200)) {
    return validationError("Price note must be between 0 and 200 characters");
  }

  if (body.price_min !== undefined && (typeof body.price_min !== "number" || body.price_min < 0)) {
    return validationError("Price min must be a non-negative number");
  }

  if (body.price_max !== undefined && (typeof body.price_max !== "number" || body.price_max < 0)) {
    return validationError("Price max must be a non-negative number");
  }

  if (
    body.price_min !== undefined &&
    body.price_max !== undefined &&
    body.price_min > body.price_max
  ) {
    return validationError("Price min cannot be greater than price max");
  }

  // Create event
  const eventData = {
    venue_id: venue.id,
    title: sanitizeString(body.title),
    start_date: body.start_date,
    start_time: body.start_time || null,
    end_date: body.end_date || null,
    end_time: body.end_time || null,
    description: body.description ? sanitizeString(body.description) : null,
    category: body.category,
    subcategory: body.genre || null,
    ticket_url: body.ticket_url || null,
    image_url: body.image_url || null,
    is_free: body.is_free || false,
    price_min: body.price_min ?? null,
    price_max: body.price_max ?? null,
    price_note: body.price_note ? sanitizeString(body.price_note) : null,
    source_type: "venue_submission",
    submitted_by: user.id,
    source_url: `${siteUrl}/venue/${slug}`,
  };

  const { data: event, error: eventError } = await serviceClient
    .from("events")
    .insert(eventData as never)
    .select()
    .single();

  if (eventError) {
    console.error("Error creating event:", eventError);
    return errorApiResponse("Failed to create event", 500);
  }

  return createdResponse({
    event,
    message: "Event submitted successfully! It will appear across all portals.",
  });
}
