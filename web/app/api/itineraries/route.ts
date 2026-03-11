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

  // Tag owned itineraries
  const owned = (data || []).map((itin: Record<string, unknown>) => ({
    ...itin,
    role: "owner",
  }));
  const ownedIds = new Set(owned.map((i: Record<string, unknown>) => i.id));

  // Fetch itineraries where user is a participant (not cant_go)
  const { data: participations } = await serviceClient
    .from("itinerary_participants")
    .select("itinerary_id, rsvp_status, id")
    .eq("user_id", user.id)
    .neq("rsvp_status", "cant_go");

  let joined: Record<string, unknown>[] = [];
  if (participations && participations.length > 0) {
    const parts = participations as { itinerary_id: string; rsvp_status: string; id: string }[];
    const joinedIds = parts
      .map((p) => p.itinerary_id)
      .filter((id) => !ownedIds.has(id));

    if (joinedIds.length > 0) {
      let joinedQuery = serviceClient
        .from("itineraries")
        .select("*")
        .in("id", joinedIds)
        .order("updated_at", { ascending: false });

      if (portalId && isValidUUID(portalId)) {
        joinedQuery = joinedQuery.eq("portal_id", portalId);
      }

      const { data: joinedData } = await joinedQuery;

      const partMap = new Map(parts.map((p) => [p.itinerary_id, p]));
      joined = (joinedData || []).map((itin: Record<string, unknown>) => {
        const part = partMap.get(itin.id as string);
        return {
          ...itin,
          role: "participant",
          my_rsvp_status: part?.rsvp_status,
          my_participant_id: part?.id,
        };
      });
    }
  }

  // Merge and sort by updated_at DESC
  const all = [...owned, ...joined].sort((a, b) => {
    const aTime = new Date((a as Record<string, unknown>).updated_at as string).getTime();
    const bTime = new Date((b as Record<string, unknown>).updated_at as string).getTime();
    return bTime - aTime;
  });

  return successResponse({ itineraries: all });
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
