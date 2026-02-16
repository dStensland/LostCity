import { NextRequest, NextResponse } from "next/server";
import { isAdmin, getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { validationError } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/admin/enrichment/proposals/[id]/review
 * Approve or reject a single proposal
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await isAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: idStr } = await context.params;
  const proposalId = parseInt(idStr, 10);
  if (isNaN(proposalId)) return validationError("Invalid proposal ID");

  let body: { action: "approve" | "reject" };
  try {
    body = await request.json();
  } catch {
    return validationError("Invalid JSON body");
  }

  if (body.action !== "approve" && body.action !== "reject") {
    return validationError("action must be 'approve' or 'reject'");
  }

  const serviceClient = createServiceClient();

  // Fetch proposal
  const { data: proposal, error: fetchErr } = await serviceClient
    .from("venue_enrichment_proposals")
    .select("*")
    .eq("id", proposalId)
    .maybeSingle();

  if (fetchErr || !proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  const p = proposal as {
    id: number;
    venue_id: number;
    field_name: string;
    proposed_value: string;
    source: string;
    status: string;
  };

  if (p.status !== "pending") {
    return NextResponse.json(
      { error: `Proposal is already ${p.status}` },
      { status: 409 }
    );
  }

  if (body.action === "reject") {
    await serviceClient
      .from("venue_enrichment_proposals")
      .update({
        status: "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      } as never)
      .eq("id", proposalId);

    return NextResponse.json({ success: true, status: "rejected" });
  }

  // Approve: apply change to venue
  // Snapshot current value
  const { data: venue } = await serviceClient
    .from("venues")
    .select(p.field_name)
    .eq("id", p.venue_id)
    .maybeSingle();

  const previousValue = venue ? (venue as Record<string, unknown>)[p.field_name] : null;

  // Parse proposed value (might be JSON-encoded)
  let parsedValue: unknown = p.proposed_value;
  try {
    parsedValue = JSON.parse(p.proposed_value);
  } catch {
    // keep as string
  }

  // Apply update to venue
  await serviceClient
    .from("venues")
    .update({ [p.field_name]: parsedValue } as never)
    .eq("id", p.venue_id);

  // Log in enrichment_log
  await serviceClient.from("venue_enrichment_log").insert({
    venue_id: p.venue_id,
    enrichment_type: `proposal:${p.field_name}`,
    status: "success",
    source: p.source,
    fields_updated: [p.field_name],
    previous_values: JSON.stringify({ [p.field_name]: previousValue }),
    ran_by: `proposal:${user.id}`,
  } as never);

  // Mark proposal approved
  await serviceClient
    .from("venue_enrichment_proposals")
    .update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    } as never)
    .eq("id", proposalId);

  return NextResponse.json({ success: true, status: "approved" });
}
