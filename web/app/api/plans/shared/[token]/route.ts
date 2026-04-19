import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import type { RateLimitConfig } from "@/lib/rate-limit";

export const runtime = "nodejs";

// 12-byte random hex → 24 chars
const ParamsSchema = z.object({ token: z.string().length(24) });

// Dedicated tight bucket — token probing gets its own rate budget.
const SHARE_BUCKET: RateLimitConfig = { limit: 20, windowSec: 60 };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const rl = await applyRateLimit(
    request,
    SHARE_BUCKET,
    `plan-share:${getClientIdentifier(request)}`,
    { bucket: "plan-share" }
  );
  if (rl) return rl;

  const resolved = await params;
  const parsed = ParamsSchema.safeParse(resolved);
  if (!parsed.success) {
    // Constant-time 404 — don't leak token validity via response shape
    await new Promise((r) => setTimeout(r, 30));
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const service = createServiceClient();
  const { data: plan } = await service
    .from("plans")
    .select("*")
    .eq("share_token", parsed.data.token as never)
    .maybeSingle();

  if (!plan) {
    await new Promise((r) => setTimeout(r, 30));
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const p = plan as { id: string; visibility: string; creator_id: string };

  let allowed = p.visibility === "public" || p.visibility === "friends";
  if (!allowed) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: invite } = await service
        .from("plan_invitees")
        .select("user_id")
        .eq("plan_id", p.id as never)
        .eq("user_id", user.id as never)
        .maybeSingle();
      allowed = !!invite;
    }
  }

  if (!allowed) {
    await new Promise((r) => setTimeout(r, 30));
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ plan });
}
