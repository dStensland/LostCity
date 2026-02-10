import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  errorApiResponse,
  validationError,
  createdResponse,
  isValidPositiveInt,
  isValidUrl,
  checkBodySize,
} from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface ClaimRequestBody {
  venue_id: number;
  proof_url?: string;
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  // Check body size
  const bodySizeCheck = checkBodySize(request);
  if (bodySizeCheck) return bodySizeCheck;

  // Verify authentication
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorApiResponse("Authentication required", 401);
  }

  // Parse and validate request body
  let body: ClaimRequestBody;
  try {
    body = await request.json();
  } catch {
    return validationError("Invalid JSON in request body");
  }

  const { venue_id, proof_url } = body;

  // Validate venue_id
  if (!isValidPositiveInt(venue_id)) {
    return validationError("Invalid venue_id");
  }

  // Validate proof_url if provided
  if (proof_url && !isValidUrl(proof_url)) {
    return validationError("Invalid proof_url - must be a valid URL");
  }

  // Use service client for database operations
  const serviceClient = createServiceClient();

  // Check if venue exists
  const { data: venue, error: venueError } = await serviceClient
    .from("venues")
    .select("id, name, website, claimed_by")
    .eq("id", venue_id)
    .maybeSingle() as {
      data: {
        id: number;
        name: string;
        website: string | null;
        claimed_by: string | null;
      } | null;
      error: unknown;
    };

  if (venueError) {
    console.error("Error fetching venue:", venueError);
    return errorApiResponse("Failed to fetch venue", 500);
  }

  if (!venue) {
    return errorApiResponse("Venue not found", 404);
  }

  // Check if venue is already claimed
  if (venue.claimed_by) {
    return errorApiResponse("This venue has already been claimed", 409);
  }

  // Check if user already has a pending claim for this venue
  const { data: existingClaim, error: existingClaimError } = await serviceClient
    .from("venue_claims")
    .select("id, status")
    .eq("venue_id", venue_id)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (existingClaimError) {
    console.error("Error checking existing claim:", existingClaimError);
    return errorApiResponse("Failed to check existing claims", 500);
  }

  if (existingClaim) {
    return errorApiResponse("You already have a pending claim for this venue", 409);
  }

  // Auto-approve if user's email domain matches venue website domain AND email is verified
  let status = "pending";
  if (user.email && user.email_confirmed_at && venue.website && proof_url) {
    try {
      const emailDomain = user.email.split("@")[1]?.toLowerCase();
      const websiteUrl = new URL(venue.website);
      const venueDomain = websiteUrl.hostname.toLowerCase().replace(/^www\./, "");

      if (emailDomain && emailDomain === venueDomain) {
        status = "approved";
      }
    } catch {
      // Invalid URL, keep as pending
    }
  }

  // Create the claim
  const { data: claim, error: claimError } = await serviceClient
    .from("venue_claims")
    .insert({
      venue_id,
      user_id: user.id,
      status,
      proof_url: proof_url || null,
      reviewed_at: status === "approved" ? new Date().toISOString() : null,
    } as never)
    .select("id, status, claimed_at")
    .single();

  if (claimError) {
    console.error("Error creating claim:", claimError);
    return errorApiResponse("Failed to create claim", 500);
  }

  // If auto-approved, update the venue
  if (status === "approved") {
    const { error: updateError } = await serviceClient
      .from("venues")
      .update({
        claimed_by: user.id,
        claimed_at: new Date().toISOString(),
        is_verified: true,
      } as never)
      .eq("id", venue_id);

    if (updateError) {
      console.error("Error updating venue after auto-approval:", updateError);
      // Don't fail the request - claim was created successfully
    }
  }

  return createdResponse({
    claim,
    message: status === "approved"
      ? "Claim approved! You now have management access to this venue."
      : "Claim submitted successfully. We'll review it and notify you once approved.",
  });
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  // Verify authentication
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorApiResponse("Authentication required", 401);
  }

  // Use service client to fetch user's claims
  const serviceClient = createServiceClient();

  const { data: claims, error: claimsError } = await serviceClient
    .from("venue_claims")
    .select(`
      id,
      venue_id,
      status,
      proof_url,
      claimed_at,
      reviewed_at,
      venues (
        id,
        name,
        slug,
        address,
        city,
        state
      )
    `)
    .eq("user_id", user.id)
    .order("claimed_at", { ascending: false });

  if (claimsError) {
    console.error("Error fetching claims:", claimsError);
    return errorApiResponse("Failed to fetch claims", 500);
  }

  return createdResponse({ claims });
}
