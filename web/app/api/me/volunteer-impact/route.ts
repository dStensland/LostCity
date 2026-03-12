import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { errorApiResponse, type AnySupabase } from "@/lib/api-utils";

type EngagementStatusRow = {
  status: string;
};

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorApiResponse("Unauthorized", 401);
  }

  const db = createServiceClient() as unknown as AnySupabase;
  const { data, error } = await db
    .from("volunteer_engagements")
    .select("status")
    .eq("user_id", user.id);

  if (error) {
    return errorApiResponse("Failed to load volunteer impact", 500);
  }

  const rows = (data || []) as EngagementStatusRow[];
  const counts = rows.reduce(
    (acc, row) => {
      if (row.status === "interested") acc.interested += 1;
      if (row.status === "committed") acc.committed += 1;
      if (row.status === "attended") acc.attended += 1;
      if (row.status === "cancelled") acc.cancelled += 1;
      if (row.status === "no_show") acc.no_show += 1;
      return acc;
    },
    {
      interested: 0,
      committed: 0,
      attended: 0,
      cancelled: 0,
      no_show: 0,
    },
  );

  return NextResponse.json({
    totals: {
      tracked: rows.length,
      ...counts,
    },
    generated_at: new Date().toISOString(),
  });
}
