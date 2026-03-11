import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import {
  checkBodySize,
  checkParsedBodySize,
  errorApiResponse,
  type AnySupabase,
} from "@/lib/api-utils";

const VALID_COMMITMENT_PREFERENCES = new Set(["drop_in", "ongoing", "lead_role", "mixed"]);

function normalizeStringArray(value: unknown, maxItems = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
    .filter(Boolean)
    .slice(0, maxItems);
}

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
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

  const db = createServiceClient() as unknown as AnySupabase;
  const { data, error } = await db
    .from("user_volunteer_profile")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return errorApiResponse("Failed to load volunteer profile", 500);
  }

  return NextResponse.json(
    data || {
      user_id: user.id,
      causes: [],
      skills: [],
      availability_windows: [],
      travel_radius_km: null,
      mobility_constraints: null,
      languages: [],
      commitment_preference: null,
    },
  );
}

export async function PATCH(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const sizeCheck = checkBodySize(request, 12288);
  if (sizeCheck) return sizeCheck;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorApiResponse("Unauthorized", 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorApiResponse("Invalid JSON body", 400);
  }

  const parsedBodyCheck = checkParsedBodySize(body, 12288);
  if (parsedBodyCheck) return parsedBodyCheck;

  const commitmentPreference =
    typeof body.commitment_preference === "string"
      ? body.commitment_preference.trim()
      : null;

  if (
    commitmentPreference !== null
    && commitmentPreference !== ""
    && !VALID_COMMITMENT_PREFERENCES.has(commitmentPreference)
  ) {
    return errorApiResponse("Invalid commitment_preference", 400);
  }

  const travelRadius =
    typeof body.travel_radius_km === "number" && Number.isFinite(body.travel_radius_km)
      ? Math.max(0, Math.min(500, Math.round(body.travel_radius_km)))
      : null;

  const payload = {
    user_id: user.id,
    causes: normalizeStringArray(body.causes, 8),
    skills: normalizeStringArray(body.skills, 16),
    availability_windows: Array.isArray(body.availability_windows) ? body.availability_windows.slice(0, 12) : [],
    travel_radius_km: travelRadius,
    mobility_constraints:
      typeof body.mobility_constraints === "string"
        ? body.mobility_constraints.trim().slice(0, 240)
        : null,
    languages: normalizeStringArray(body.languages, 10),
    commitment_preference: commitmentPreference || null,
  };

  const db = createServiceClient() as unknown as AnySupabase;
  const { data, error } = await db
    .from("user_volunteer_profile")
    .upsert(payload, {
      onConflict: "user_id",
    })
    .select("*")
    .single();

  if (error) {
    return errorApiResponse("Failed to save volunteer profile", 500);
  }

  return NextResponse.json(data);
}
