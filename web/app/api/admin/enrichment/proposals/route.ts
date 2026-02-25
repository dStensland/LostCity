import { NextRequest, NextResponse } from "next/server";
import { isAdmin, getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { parseIntParam, validationError } from "@/lib/api-utils";
import { normalizeNeighborhoodName } from "@/config/neighborhoods";

export const dynamic = "force-dynamic";

const ALLOWED_FIELDS = new Set([
  "description",
  "short_description",
  "explore_blurb",
  "venue_type",
  "vibes",
  "neighborhood",
  "image_url",
  "hero_image_url",
  "website",
  "hours",
  "phone",
  "parking_type",
  "transit_options",
]);

type ProposalInput = {
  venue_id: number;
  field_name: string;
  proposed_value: string;
  source?: string;
  confidence?: number;
  reasoning?: string;
  batch_id?: string;
};

/**
 * POST /api/admin/enrichment/proposals
 * Create enrichment proposals (batch). Supersedes pending for same venue+field.
 */
export async function POST(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await isAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { proposals: ProposalInput[] };
  try {
    body = await request.json();
  } catch {
    return validationError("Invalid JSON body");
  }

  if (!Array.isArray(body.proposals) || body.proposals.length === 0) {
    return validationError("proposals must be a non-empty array");
  }

  if (body.proposals.length > 200) {
    return validationError("Max 200 proposals per request");
  }

  // Validate all proposals before inserting any
  for (const p of body.proposals) {
    if (!p.venue_id || !p.field_name || !p.proposed_value) {
      return validationError("Each proposal requires venue_id, field_name, proposed_value");
    }
    if (!ALLOWED_FIELDS.has(p.field_name)) {
      return validationError(`Invalid field_name: ${p.field_name}`);
    }
    if (p.confidence !== undefined && (p.confidence < 0 || p.confidence > 1)) {
      return validationError("confidence must be between 0 and 1");
    }
  }

  const serviceClient = createServiceClient();

  let created = 0;
  let superseded = 0;

  for (const p of body.proposals) {
    // Supersede existing pending proposals for same venue+field
    const { data: existing } = await serviceClient
      .from("venue_enrichment_proposals")
      .select("id")
      .eq("venue_id", p.venue_id)
      .eq("field_name", p.field_name)
      .eq("status", "pending");

    if (existing && existing.length > 0) {
      const ids = existing.map((e: { id: number }) => e.id);
      await serviceClient
        .from("venue_enrichment_proposals")
        .update({ status: "superseded" } as never)
        .in("id", ids);
      superseded += ids.length;
    }

    // Get current value for context
    const { data: venue } = await serviceClient
      .from("venues")
      .select(p.field_name)
      .eq("id", p.venue_id)
      .maybeSingle();

    const currentRaw = venue ? (venue as Record<string, unknown>)[p.field_name] : null;
    const currentValue = currentRaw != null
      ? (typeof currentRaw === "string" ? currentRaw : JSON.stringify(currentRaw))
      : null;

    await serviceClient.from("venue_enrichment_proposals").insert({
      venue_id: p.venue_id,
      field_name: p.field_name,
      current_value: currentValue,
      proposed_value: p.field_name === "neighborhood"
        ? normalizeNeighborhoodName(p.proposed_value)
        : p.proposed_value,
      source: p.source ?? "agent",
      confidence: p.confidence ?? 0.8,
      reasoning: p.reasoning ?? "",
      batch_id: p.batch_id ?? null,
    } as never);

    created++;
  }

  return NextResponse.json({ created, superseded });
}

/**
 * GET /api/admin/enrichment/proposals
 * List proposals for review with filtering
 */
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await isAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "pending";
  const fieldName = searchParams.get("field_name");
  const batchId = searchParams.get("batch_id");
  const limit = Math.min(parseIntParam(searchParams.get("limit"), 50) ?? 50, 200);
  const offset = parseIntParam(searchParams.get("offset"), 0) ?? 0;

  const serviceClient = createServiceClient();

  let query = serviceClient
    .from("venue_enrichment_proposals")
    .select("*, venues(id, name, slug)", { count: "exact" })
    .eq("status", status)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (fieldName) query = query.eq("field_name", fieldName);
  if (batchId) query = query.eq("batch_id", batchId);

  const { data, count, error } = await query;

  if (error) {
    console.error("Proposals list error:", error);
    return NextResponse.json({ error: "Failed to fetch proposals" }, { status: 500 });
  }

  return NextResponse.json({ proposals: data ?? [], total: count ?? 0 });
}
