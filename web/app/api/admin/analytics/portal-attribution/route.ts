import { NextRequest, NextResponse } from "next/server";
import { createClient, isAdmin } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { adminErrorResponse } from "@/lib/api-utils";

type AttributionAuditRow = {
  table_name: string;
  missing_portal: number;
  total: number;
  pct_missing: number;
};

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();

  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const maxMissingPctRaw = searchParams.get("max_missing_pct");
  const maxMissingPct = Number.isFinite(Number(maxMissingPctRaw))
    ? Math.max(0, Math.min(100, Number(maxMissingPctRaw)))
    : 0;

  const { data, error } = await supabase
    .from("portal_attribution_audit")
    .select("table_name, missing_portal, total, pct_missing");

  if (error) {
    return adminErrorResponse(
      error,
      "GET /api/admin/analytics/portal-attribution - audit query"
    );
  }

  const rows = ((data || []) as AttributionAuditRow[]).map((row) => ({
    table_name: row.table_name,
    missing_portal: row.missing_portal || 0,
    total: row.total || 0,
    pct_missing: Number(row.pct_missing || 0),
  }));

  const violating = rows.filter((row) => row.pct_missing > maxMissingPct);
  const totalMissing = rows.reduce((sum, row) => sum + row.missing_portal, 0);
  const totalRows = rows.reduce((sum, row) => sum + row.total, 0);
  const overallPctMissing =
    totalRows > 0 ? Number(((totalMissing / totalRows) * 100).toFixed(2)) : 0;

  return NextResponse.json({
    threshold: { max_missing_pct: maxMissingPct },
    summary: {
      tables_checked: rows.length,
      tables_violating_threshold: violating.length,
      total_missing_portal: totalMissing,
      total_rows: totalRows,
      overall_pct_missing: overallPctMissing,
      healthy: violating.length === 0,
    },
    rows,
    violating,
  });
}
