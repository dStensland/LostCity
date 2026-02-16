import { NextRequest, NextResponse } from "next/server";
import { isAdmin, getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { validationError } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/enrichment/proposals/batch-review
 * Bulk approve or reject proposals by ID list
 */
export async function POST(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await isAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { ids: number[]; action: "approve" | "reject" };
  try {
    body = await request.json();
  } catch {
    return validationError("Invalid JSON body");
  }

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return validationError("ids must be a non-empty array of numbers");
  }

  if (body.ids.length > 200) {
    return validationError("Max 200 proposals per batch review");
  }

  if (body.action !== "approve" && body.action !== "reject") {
    return validationError("action must be 'approve' or 'reject'");
  }

  const serviceClient = createServiceClient();

  // Fetch all pending proposals with these IDs
  const { data: proposals, error: fetchErr } = await serviceClient
    .from("venue_enrichment_proposals")
    .select("*")
    .in("id", body.ids)
    .eq("status", "pending");

  if (fetchErr) {
    console.error("Batch review fetch error:", fetchErr);
    return NextResponse.json({ error: "Failed to fetch proposals" }, { status: 500 });
  }

  const pending = (proposals ?? []) as {
    id: number;
    venue_id: number;
    field_name: string;
    proposed_value: string;
    source: string;
  }[];

  let processed = 0;
  let skipped = body.ids.length - pending.length; // IDs that weren't pending

  if (body.action === "reject") {
    // Bulk reject — simple status update
    if (pending.length > 0) {
      await serviceClient
        .from("venue_enrichment_proposals")
        .update({
          status: "rejected",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        } as never)
        .in("id", pending.map((p) => p.id));
      processed = pending.length;
    }

    return NextResponse.json({ processed, skipped });
  }

  // Bulk approve — apply each change individually
  for (const p of pending) {
    try {
      // Snapshot
      const { data: venue } = await serviceClient
        .from("venues")
        .select(p.field_name)
        .eq("id", p.venue_id)
        .maybeSingle();

      const previousValue = venue
        ? (venue as Record<string, unknown>)[p.field_name]
        : null;

      let parsedValue: unknown = p.proposed_value;
      try {
        parsedValue = JSON.parse(p.proposed_value);
      } catch {
        // keep as string
      }

      // Apply
      await serviceClient
        .from("venues")
        .update({ [p.field_name]: parsedValue } as never)
        .eq("id", p.venue_id);

      // Log
      await serviceClient.from("venue_enrichment_log").insert({
        venue_id: p.venue_id,
        enrichment_type: `proposal:${p.field_name}`,
        status: "success",
        source: p.source,
        fields_updated: [p.field_name],
        previous_values: JSON.stringify({ [p.field_name]: previousValue }),
        ran_by: `batch-review:${user.id}`,
      } as never);

      // Mark approved
      await serviceClient
        .from("venue_enrichment_proposals")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        } as never)
        .eq("id", p.id);

      processed++;
    } catch (err) {
      console.error(`Failed to approve proposal ${p.id}:`, err);
      skipped++;
    }
  }

  return NextResponse.json({ processed, skipped });
}
