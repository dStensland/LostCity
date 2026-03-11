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
import { resolvePortalAttributionForWrite } from "@/lib/portal-attribution";

const VALID_STATUSES = new Set([
  "interested",
  "committed",
  "attended",
  "cancelled",
  "no_show",
]);

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    getClientIdentifier(request),
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

  const { id } = await context.params;
  if (!id) {
    return errorApiResponse("Engagement id is required", 400);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorApiResponse("Invalid JSON body", 400);
  }

  const parsedBodyCheck = checkParsedBodySize(body, 8192);
  if (parsedBodyCheck) return parsedBodyCheck;

  const attribution = await resolvePortalAttributionForWrite(request, {
    endpoint: "/api/volunteer/engagements/[id]",
    body,
    requireWhenHinted: true,
  });

  if (attribution.response) {
    return attribution.response;
  }

  const status = typeof body.status === "string" ? body.status.trim() : "";
  const note =
    typeof body.note === "string" ? body.note.trim().slice(0, 500) : undefined;

  if (!VALID_STATUSES.has(status)) {
    return errorApiResponse("Invalid status", 400);
  }

  const db = createServiceClient() as unknown as AnySupabase;

  const { data: existingData, error: existingError } = await db
    .from("volunteer_engagements")
    .select("id, user_id, portal_id")
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    return errorApiResponse("Failed to resolve volunteer engagement", 500);
  }

  const existing = existingData as {
    id: string;
    user_id: string;
    portal_id: string | null;
  } | null;
  if (!existing) {
    return errorApiResponse("Volunteer engagement not found", 404);
  }

  if (existing.user_id !== user.id) {
    return errorApiResponse("Forbidden", 403);
  }

  if (
    attribution.portalId
    && existing.portal_id
    && attribution.portalId !== existing.portal_id
  ) {
    return errorApiResponse(
      "portal and portal_id parameters must reference the same portal",
      400,
    );
  }

  const updatePayload: Record<string, unknown> = { status };
  if (note !== undefined) {
    updatePayload.note = note || null;
  }

  const { data, error } = await db
    .from("volunteer_engagements")
    .update(updatePayload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return errorApiResponse("Failed to update volunteer engagement", 500);
  }

  return NextResponse.json({ engagement: data });
}
