import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getUser, isAdmin } from "@/lib/supabase/server";
import { isValidUUID, adminErrorResponse, checkBodySize } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

type Props = {
  params: Promise<{ id: string }>;
};

const TRUST_TIERS = ["standard", "trusted_submitter"] as const;

// POST /api/admin/users/[id]/trust - Update user trust tier
export async function POST(request: NextRequest, { params }: Props) {
  // Check body size
  const bodySizeError = checkBodySize(request);
  if (bodySizeError) return bodySizeError;

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id } = await params;

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isGlobalAdmin = await isAdmin();
  if (!isGlobalAdmin) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { trust_tier, reason } = body as { trust_tier?: string; reason?: string };

  if (!trust_tier || !TRUST_TIERS.includes(trust_tier as typeof TRUST_TIERS[number])) {
    return NextResponse.json(
      { error: "Invalid trust_tier. Must be standard or trusted_submitter." },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  const { data: profileData } = await serviceClient
    .from("profiles")
    .select("id, trust_tier")
    .eq("id", id)
    .maybeSingle();

  const profile = profileData as { id: string; trust_tier: string | null } | null;
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (profile.trust_tier === trust_tier) {
    return NextResponse.json({
      profile,
      message: "Trust tier already set",
    });
  }

  const { data: updated, error: updateError } = await serviceClient
    .from("profiles")
    .update({ trust_tier } as never)
    .eq("id", id)
    .select("id, trust_tier")
    .maybeSingle();

  if (updateError) {
    return adminErrorResponse(updateError, "trust tier update");
  }

  const action =
    trust_tier === "trusted_submitter"
      ? "promoted_to_trusted"
      : "demoted_to_standard";

  await serviceClient
    .from("trust_actions")
    .insert({
      user_id: id,
      action,
      performed_by: user.id,
      reason: reason?.trim() || null,
    } as never);

  return NextResponse.json({
    profile: updated,
    message: "Trust tier updated",
  });
}
