import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser, isAdmin } from "@/lib/supabase/server";
import { isValidUUID, isValidString, adminErrorResponse } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

type Props = {
  params: Promise<{ id: string }>;
};

// POST /api/admin/claims/[id]/request-info - Request more info on a claim request
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
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !claimData) {
    return NextResponse.json({ error: "Claim request not found" }, { status: 404 });
  }

  if (!["pending"].includes(claimData.status)) {
    return NextResponse.json(
      { error: `Cannot request info for status: ${claimData.status}` },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { message } = body as { message?: string };

  if (!message || !isValidString(message, 10, 1000)) {
    return NextResponse.json(
      { error: "message is required (10-1000 characters)" },
      { status: 400 }
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("entity_claim_requests")
    .update({
      status: "needs_info",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: message,
    } as never)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (updateError) {
    return adminErrorResponse(updateError, "claim request-info");
  }

  return NextResponse.json({
    claim: updated,
    message: "Info request sent",
  });
}
