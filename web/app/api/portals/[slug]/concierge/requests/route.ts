import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import {
  checkBodySize,
  isValidEnum,
  isValidString,
  successResponse,
  createdResponse,
  errorApiResponse,
  validationError,
} from "@/lib/api-utils";

const VALID_REQUEST_TYPES = [
  "restaurant_reservation",
  "activity_booking",
  "transportation",
  "custom",
] as const;

type RouteContext = {
  params: Promise<{ slug: string }>;
};

type ConciergeRequestBody = {
  request_type?: string;
  details?: string;
  preferred_time?: string;
  party_size?: number;
  guest_contact?: {
    name?: string;
    room?: string;
    phone?: string;
    email?: string;
  };
};

// GET /api/portals/[slug]/concierge/requests — list user's requests
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return errorApiResponse("Unauthorized", 401);
  }

  const { slug } = await context.params;
  const serviceClient = createServiceClient();

  const { data: portal } = await serviceClient
    .from("portals")
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  const portalData = portal as { id: string } | null;
  if (!portalData) {
    return errorApiResponse("Portal not found", 404);
  }

  const { data: requests, error } = await serviceClient
    .from("concierge_requests")
    .select("*")
    .eq("portal_id", portalData.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error fetching concierge requests:", error.message);
    return errorApiResponse("Failed to fetch requests", 500);
  }

  return successResponse({ requests: requests || [] });
}

// POST /api/portals/[slug]/concierge/requests — submit a concierge request
export async function POST(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const sizeCheck = checkBodySize(request, 4096);
  if (sizeCheck) return sizeCheck;

  const { slug } = await context.params;

  let body: ConciergeRequestBody;
  try {
    body = (await request.json()) as ConciergeRequestBody;
  } catch {
    return validationError("Invalid JSON body");
  }

  if (!isValidEnum(body.request_type, VALID_REQUEST_TYPES)) {
    return validationError("Invalid request_type. Must be: restaurant_reservation, activity_booking, transportation, or custom");
  }

  if (!isValidString(body.details, 1, 1000)) {
    return validationError("details is required (max 1000 characters)");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return errorApiResponse("Unauthorized", 401);
  }

  const serviceClient = createServiceClient();

  const { data: portal } = await serviceClient
    .from("portals")
    .select("id, slug")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  const portalData = portal as { id: string; slug: string } | null;
  if (!portalData) {
    return errorApiResponse("Portal not found", 404);
  }

  const insertData = {
    portal_id: portalData.id,
    user_id: user.id,
    request_type: body.request_type,
    details: body.details!.slice(0, 1000),
    preferred_time: typeof body.preferred_time === "string"
      ? body.preferred_time.slice(0, 100)
      : null,
    party_size: typeof body.party_size === "number" && body.party_size > 0 && body.party_size <= 50
      ? body.party_size
      : null,
    guest_contact: body.guest_contact && typeof body.guest_contact === "object"
      ? {
          name: typeof body.guest_contact.name === "string"
            ? body.guest_contact.name.slice(0, 100)
            : undefined,
          room: typeof body.guest_contact.room === "string"
            ? body.guest_contact.room.slice(0, 20)
            : undefined,
          phone: typeof body.guest_contact.phone === "string"
            ? body.guest_contact.phone.slice(0, 20)
            : undefined,
          email: typeof body.guest_contact.email === "string"
            ? body.guest_contact.email.slice(0, 100)
            : undefined,
        }
      : {},
    status: "pending",
  };

  const { data: req, error } = await serviceClient
    .from("concierge_requests")
    .insert(insertData as never)
    .select()
    .single();

  if (error) {
    console.error("Error creating concierge request:", error.message);
    return errorApiResponse("Failed to submit request", 500);
  }

  return createdResponse({
    request: req,
    message: "Your request has been submitted. Our team will be in touch shortly.",
  });
}
