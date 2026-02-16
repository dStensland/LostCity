import { withAuth } from "@/lib/api-middleware";
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
  createdResponse,
  errorApiResponse,
  validationError,
} from "@/lib/api-utils";

// GET /api/itineraries — list current user's itineraries
export const GET = withAuth(async (request, { user, serviceClient }) => {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);
  const portalId = searchParams.get("portal_id");

  let query = serviceClient
    .from("itineraries")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (portalId && isValidUUID(portalId)) {
    query = query.eq("portal_id", portalId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error listing itineraries:", error.message);
    return errorApiResponse("Failed to list itineraries", 500);
  }

  return successResponse({ itineraries: data || [] });
});

// POST /api/itineraries — create a new itinerary
export const POST = withAuth(async (request, { user, serviceClient }) => {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const sizeCheck = checkBodySize(request, 4096);
  if (sizeCheck) return sizeCheck;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return validationError("Invalid JSON body");
  }

  if (!isValidUUID(body.portal_id)) {
    return validationError("portal_id is required and must be a valid UUID");
  }

  // Verify portal exists
  const { data: portal } = await serviceClient
    .from("portals")
    .select("id")
    .eq("id", body.portal_id)
    .eq("status", "active")
    .maybeSingle();

  if (!portal) {
    return errorApiResponse("Portal not found", 404);
  }

  const title =
    typeof body.title === "string" && isValidString(body.title, 1, 200)
      ? body.title
      : "My Itinerary";

  const date =
    typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : null;

  const description =
    typeof body.description === "string" &&
    isValidString(body.description, 0, 1000)
      ? body.description
      : null;

  // Generate cryptographically random share token
  const shareToken = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

  const { data: itinerary, error } = await serviceClient
    .from("itineraries")
    .insert({
      user_id: user.id,
      portal_id: body.portal_id,
      title,
      date,
      description,
      share_token: shareToken,
      is_public: false,
    } as never)
    .select()
    .single();

  if (error) {
    console.error("Error creating itinerary:", error.message);
    return errorApiResponse("Failed to create itinerary", 500);
  }

  return createdResponse({ itinerary });
});
