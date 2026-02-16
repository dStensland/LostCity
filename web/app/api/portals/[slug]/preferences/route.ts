import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import {
  checkBodySize,
  isValidEnum,
  successResponse,
  errorApiResponse,
  validationError,
} from "@/lib/api-utils";
import type {
  TravelParty,
  InterestTag,
  DietaryNeed,
} from "@/lib/onboarding-utils";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

const VALID_TRAVEL_PARTIES = [
  "alone",
  "couple",
  "family",
  "group",
] as const;
const VALID_INTERESTS = [
  "food",
  "nightlife",
  "arts",
  "outdoors",
  "wellness",
  "music",
  "sports",
] as const;
const VALID_DIETARY = [
  "vegetarian",
  "vegan",
  "gluten_free",
  "nut_allergy",
  "dairy_free",
  "halal",
  "kosher",
] as const;

// GET /api/portals/[slug]/preferences — fetch current user's preferences for this portal
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorApiResponse("Unauthorized", 401);
  }

  const { slug } = await context.params;
  const serviceClient = createServiceClient();

  // Look up portal
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

  const { data: prefs, error } = await serviceClient
    .from("portal_preferences")
    .select("*")
    .eq("user_id", user.id)
    .eq("portal_id", portalData.id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching preferences:", error.message);
    return errorApiResponse("Failed to fetch preferences", 500);
  }

  return successResponse({ preferences: prefs || null });
}

// POST /api/portals/[slug]/preferences — upsert preferences
export async function POST(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const sizeCheck = checkBodySize(request, 8192);
  if (sizeCheck) return sizeCheck;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorApiResponse("Unauthorized", 401);
  }

  const { slug } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return validationError("Invalid JSON body");
  }

  // Validate fields
  if (
    body.travel_party !== undefined &&
    body.travel_party !== null &&
    !isValidEnum(body.travel_party, VALID_TRAVEL_PARTIES)
  ) {
    return validationError("Invalid travel_party");
  }

  if (body.interests !== undefined) {
    if (!Array.isArray(body.interests)) {
      return validationError("interests must be an array");
    }
    for (const i of body.interests) {
      if (!isValidEnum(i, VALID_INTERESTS)) {
        return validationError("Invalid interest value");
      }
    }
  }

  if (body.dietary_needs !== undefined) {
    if (!Array.isArray(body.dietary_needs)) {
      return validationError("dietary_needs must be an array");
    }
    for (const d of body.dietary_needs) {
      if (!isValidEnum(d, VALID_DIETARY)) {
        return validationError("Invalid dietary_needs value");
      }
    }
  }

  const serviceClient = createServiceClient();

  // Look up portal
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

  const upsertData = {
    user_id: user.id,
    portal_id: portalData.id,
    travel_party: (body.travel_party as TravelParty) || null,
    interests: (body.interests as InterestTag[]) || [],
    dietary_needs: (body.dietary_needs as DietaryNeed[]) || [],
    preferred_guest_intent:
      typeof body.preferred_guest_intent === "string"
        ? body.preferred_guest_intent.slice(0, 50)
        : null,
    preferred_experience_view:
      typeof body.preferred_experience_view === "string"
        ? body.preferred_experience_view.slice(0, 50)
        : null,
    mobility_preferences:
      body.mobility_preferences &&
      typeof body.mobility_preferences === "object"
        ? body.mobility_preferences
        : {},
    onboarding_completed_at: body.onboarding_completed_at
      ? new Date().toISOString()
      : undefined,
    updated_at: new Date().toISOString(),
  };

  const { data: prefs, error } = await serviceClient
    .from("portal_preferences")
    .upsert(upsertData as never, {
      onConflict: "user_id,portal_id",
    })
    .select()
    .single();

  if (error) {
    console.error("Error upserting preferences:", error.message);
    return errorApiResponse("Failed to save preferences", 500);
  }

  return successResponse({ preferences: prefs });
}
