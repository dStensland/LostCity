import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser, isAdmin } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isValidUUID, adminErrorResponse } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

type Props = {
  params: Promise<{ id: string }>;
};

// POST /api/admin/claims/[id]/approve - Approve a claim request
export async function POST(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid claim request ID" }, { status: 400 });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const supabase = await createClient();

  const { data: claimData, error: fetchError } = await supabase
    .from("entity_claim_requests")
    .select("id, status, requested_by, venue_id, organization_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !claimData) {
    return NextResponse.json({ error: "Claim request not found" }, { status: 404 });
  }

  const claim = claimData as {
    id: string;
    status: string;
    requested_by: string;
    venue_id: number | null;
    organization_id: string | null;
  };

  if (!["pending", "needs_info"].includes(claim.status)) {
    return NextResponse.json(
      { error: `Cannot approve claim with status: ${claim.status}` },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  const claimQuery = serviceClient
    .from("entity_claims")
    .select("id")
    .eq("user_id", claim.requested_by);

  const existingClaim = claim.venue_id
    ? await claimQuery.eq("venue_id", claim.venue_id).maybeSingle()
    : await claimQuery.eq("organization_id", claim.organization_id as string).maybeSingle();

  if (!existingClaim.data) {
    const insertPayload = {
      user_id: claim.requested_by,
      venue_id: claim.venue_id || null,
      organization_id: claim.organization_id || null,
      role: "manager",
      created_from_request: claim.id,
    };

    const { error: insertError } = await serviceClient
      .from("entity_claims")
      .insert(insertPayload as never);

    if (insertError) {
      return adminErrorResponse(insertError, "claim approval");
    }
  }

  if (claim.organization_id) {
    await serviceClient
      .from("organizations")
      .update({ is_verified: true } as never)
      .eq("id", claim.organization_id);
  }

  const { data: updated, error: updateError } = await supabase
    .from("entity_claim_requests")
    .update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    } as never)
    .eq("id", claim.id)
    .select()
    .maybeSingle();

  if (updateError) {
    return adminErrorResponse(updateError, "claim approval");
  }

  return NextResponse.json({
    claim: updated,
    message: "Claim request approved",
  });
}
