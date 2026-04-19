import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: NextRequest): boolean {
  const expectedKey = process.env.PLANS_EXPIRE_CRON_API_KEY;
  if (!expectedKey) return false;

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : "";
  if (!token || token.length !== expectedKey.length) return false;

  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expectedKey));
  } catch {
    return false;
  }
}

// POST /api/cron/plans-expire
// Secure machine endpoint — call expire_stale_plans() to sweep planning/active
// plans whose starts_at + 6h is in the past. Scheduled every 15 minutes via
// GitHub Actions (.github/workflows/cron-plans-expire.yml).
export async function POST(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.standard, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data, error } = await service.rpc("expire_stale_plans" as never);

  if (error) {
    logger.error("plans-expire sweep failed", error, { component: "plans-expire" });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // expire_stale_plans returns TABLE(expired_count integer)
  const rows = (data as Array<{ expired_count: number }> | null) ?? [];
  const count = rows[0]?.expired_count ?? 0;

  logger.info("plans-expire sweep complete", { count, component: "plans-expire" });
  return NextResponse.json({ expired: count });
}
