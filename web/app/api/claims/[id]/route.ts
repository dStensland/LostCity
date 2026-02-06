import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { isValidUUID, isValidString } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

type Props = {
  params: Promise<{ id: string }>;
};

// GET /api/claims/[id] - Get a single claim request
export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id } = await params;
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid claim request ID" }, { status: 400 });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("entity_claim_requests")
    .select(
      `
      id,
      status,
      venue_id,
      organization_id,
      verification_method,
      verification_domain,
      verification_token,
      notes,
      rejection_reason,
      created_at,
      updated_at,
      reviewed_at,
      venue:venues(id, name, slug),
      organization:organizations(id, name, slug)
    `
    )
    .eq("id", id)
    .eq("requested_by", user.id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Claim request not found" }, { status: 404 });
  }

  return NextResponse.json({ claim: data });
}

// PATCH /api/claims/[id] - Update a claim request (pending/needs_info)
export async function PATCH(request: NextRequest, { params }: Props) {
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

  const body = await request.json();
  const {
    verification_method,
    verification_domain,
    verification_token,
    notes,
  } = body as {
    verification_method?: string;
    verification_domain?: string;
    verification_token?: string;
    notes?: string;
  };

  if (verification_method && !isValidString(verification_method, 2, 50)) {
    return NextResponse.json({ error: "Invalid verification_method" }, { status: 400 });
  }

  if (verification_domain && !isValidString(verification_domain, 2, 120)) {
    return NextResponse.json({ error: "Invalid verification_domain" }, { status: 400 });
  }

  if (verification_token && !isValidString(verification_token, 2, 500)) {
    return NextResponse.json({ error: "Invalid verification_token" }, { status: 400 });
  }

  if (notes && !isValidString(notes, 2, 1000)) {
    return NextResponse.json({ error: "Invalid notes" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("entity_claim_requests")
    .select("id, status")
    .eq("id", id)
    .eq("requested_by", user.id)
    .maybeSingle();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Claim request not found" }, { status: 404 });
  }

  if (!["pending", "needs_info"].includes(existing.status)) {
    return NextResponse.json(
      { error: `Cannot update claim with status: ${existing.status}` },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (verification_method !== undefined) updates.verification_method = verification_method;
  if (verification_domain !== undefined) updates.verification_domain = verification_domain;
  if (verification_token !== undefined) updates.verification_token = verification_token;
  if (notes !== undefined) updates.notes = notes;
  if (existing.status === "needs_info") {
    updates.status = "pending";
    updates.rejection_reason = null;
  }

  const { data: updated, error: updateError } = await supabase
    .from("entity_claim_requests")
    .update(updates as never)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: "Failed to update claim request" }, { status: 500 });
  }

  return NextResponse.json({ claim: updated });
}
