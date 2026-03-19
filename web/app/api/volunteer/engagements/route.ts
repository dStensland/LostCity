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

const VALID_STATUSES = new Set(["interested", "committed"]);

export async function POST(request: NextRequest) {
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

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorApiResponse("Invalid JSON body", 400);
  }

  const parsedBodyCheck = checkParsedBodySize(body, 8192);
  if (parsedBodyCheck) return parsedBodyCheck;

  const attribution = await resolvePortalAttributionForWrite(request, {
    endpoint: "/api/volunteer/engagements",
    body,
    allowMissing: true,
    requireWhenHinted: true,
  });

  if (attribution.response) {
    return attribution.response;
  }

  const opportunityId =
    typeof body.opportunity_id === "string" ? body.opportunity_id.trim() : "";
  const status =
    typeof body.status === "string" ? body.status.trim() : "interested";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

  if (!opportunityId) {
    return errorApiResponse("opportunity_id is required", 400);
  }

  if (!VALID_STATUSES.has(status)) {
    return errorApiResponse("Invalid status", 400);
  }

  const db = createServiceClient() as unknown as AnySupabase;

  const { data: opportunityData, error: opportunityError } = await db
    .from("volunteer_opportunities")
    .select("id, event_id, portal_id, is_active")
    .eq("id", opportunityId)
    .maybeSingle();

  if (opportunityError) {
    return errorApiResponse("Failed to resolve opportunity", 500);
  }

  const opportunity = opportunityData as {
    id: string;
    event_id: number | null;
    portal_id: string | null;
    is_active: boolean;
  } | null;

  if (!opportunity || !opportunity.is_active) {
    return errorApiResponse("Opportunity not found", 404);
  }

  if (
    attribution.portalId
    && opportunity.portal_id
    && attribution.portalId !== opportunity.portal_id
  ) {
    return errorApiResponse(
      "portal and portal_id parameters must reference the same portal",
      400,
    );
  }

  const payload = {
    user_id: user.id,
    opportunity_id: opportunity.id,
    event_id: opportunity.event_id,
    portal_id: attribution.portalId ?? opportunity.portal_id,
    status,
    note,
  };

  const { data, error } = await db
    .from("volunteer_engagements")
    .upsert(payload, {
      onConflict: "user_id,opportunity_id",
    })
    .select("*")
    .single();

  if (error) {
    return errorApiResponse("Failed to save volunteer engagement", 500);
  }

  return NextResponse.json({ engagement: data }, { status: 201 });
}
