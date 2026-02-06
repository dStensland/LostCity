import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { isValidEnum, isValidString } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

const CLAIM_STATUSES = ["pending", "approved", "rejected", "needs_info"] as const;

// GET /api/claims - Get user's claim requests
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const offset = parseInt(searchParams.get("offset") || "0");

  const supabase = await createClient();

  let query = supabase
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
    `,
      { count: "exact" }
    )
    .eq("requested_by", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && isValidEnum(status, CLAIM_STATUSES)) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: "Failed to fetch claim requests" }, { status: 500 });
  }

  return NextResponse.json({
    claims: data || [],
    pagination: {
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
    },
  });
}

// POST /api/claims - Create a claim request
export async function POST(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    venue_id,
    organization_id,
    verification_method,
    verification_domain,
    verification_token,
    notes,
  } = body as {
    venue_id?: number;
    organization_id?: string;
    verification_method?: string;
    verification_domain?: string;
    verification_token?: string;
    notes?: string;
  };

  if ((venue_id && organization_id) || (!venue_id && !organization_id)) {
    return NextResponse.json(
      { error: "Provide exactly one of venue_id or organization_id" },
      { status: 400 }
    );
  }

  if (venue_id && (!Number.isInteger(venue_id) || venue_id <= 0)) {
    return NextResponse.json({ error: "Invalid venue_id" }, { status: 400 });
  }

  if (organization_id && !isValidString(organization_id, 2, 200)) {
    return NextResponse.json({ error: "Invalid organization_id" }, { status: 400 });
  }

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

  if (venue_id) {
    const { data: venue } = await supabase
      .from("venues")
      .select("id")
      .eq("id", venue_id)
      .maybeSingle();
    if (!venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }
  }

  if (organization_id) {
    const { data: organization } = await supabase
      .from("organizations")
      .select("id")
      .eq("id", organization_id)
      .maybeSingle();
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
  }

  const existingClaimQuery = supabase
    .from("entity_claims")
    .select("id")
    .eq("user_id", user.id);
  const existingClaim =
    venue_id
      ? await existingClaimQuery.eq("venue_id", venue_id).maybeSingle()
      : await existingClaimQuery.eq("organization_id", organization_id as string).maybeSingle();

  if (existingClaim.data) {
    return NextResponse.json(
      { error: "You already have an approved claim for this entity." },
      { status: 409 }
    );
  }

  const existingRequestQuery = supabase
    .from("entity_claim_requests")
    .select("id, status")
    .eq("requested_by", user.id);

  const existingRequest =
    venue_id
      ? await existingRequestQuery.eq("venue_id", venue_id).maybeSingle()
      : await existingRequestQuery.eq("organization_id", organization_id as string).maybeSingle();

  const existingReq = existingRequest.data as { id: string; status: string } | null;
  if (existingReq && ["pending", "needs_info", "approved"].includes(existingReq.status)) {
    return NextResponse.json(
      { error: "You already have a claim request for this entity." },
      { status: 409 }
    );
  }

  const { data: claim, error } = await supabase
    .from("entity_claim_requests")
    .insert({
      requested_by: user.id,
      venue_id: venue_id || null,
      organization_id: organization_id || null,
      verification_method: verification_method || null,
      verification_domain: verification_domain || null,
      verification_token: verification_token || null,
      notes: notes?.trim() || null,
    } as never)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to create claim request" }, { status: 500 });
  }

  return NextResponse.json({ claim }, { status: 201 });
}
