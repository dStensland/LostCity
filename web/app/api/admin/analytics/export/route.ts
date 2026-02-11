import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getLocalDateString } from "@/lib/formats";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { computeAttributedDailyMetrics, type DailyMetric } from "@/lib/analytics/attributed-metrics";

export const dynamic = "force-dynamic";

type Portal = {
  id: string;
  name: string;
  slug: string;
};

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.standard, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();

  // Verify admin
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get("format") || "csv";
  const portalId = searchParams.get("portal_id");
  const startDateParam = searchParams.get("start_date");
  const endDateParam = searchParams.get("end_date");

  // Default to last 30 days
  const endDate = endDateParam || getLocalDateString();
  const startDate = startDateParam || (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return getLocalDateString(d);
  })();

  // Get portals for name lookup
  const { data: portals } = await supabase
    .from("portals")
    .select("id, name, slug");

  const portalMap = new Map<string, Portal>();
  for (const p of (portals || []) as Portal[]) {
    portalMap.set(p.id, p);
  }

  // Build query
  let query = supabase
    .from("analytics_daily_portal")
    .select("date, portal_id, event_views, event_rsvps, event_saves, event_shares, new_signups, active_users, events_total, events_created, sources_active, crawl_runs, crawl_success_rate")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true })
    .order("portal_id", { ascending: true });

  if (portalId) {
    query = query.eq("portal_id", portalId);
  }

  const { data: analyticsData, error } = await query;
  const metrics = (analyticsData || []) as DailyMetric[];

  // If no aggregated rows exist (or table is unavailable), compute strict portal-attributed metrics.
  if (error || metrics.length === 0) {
    const targetPortalIds = portalId
      ? (portals as Portal[] || []).filter((p) => p.id === portalId).map((p) => p.id)
      : (portals as Portal[] || []).map((p) => p.id);

    const computedMetrics = await computeAttributedDailyMetrics(supabase, {
      portalIds: targetPortalIds,
      startDate,
      endDate,
    });

    if (computedMetrics.length === 0 && error) {
      return generateEmptyExport(format, startDate, endDate);
    }

    return generateExport(format, computedMetrics, portalMap, startDate, endDate);
  }

  return generateExport(format, metrics, portalMap, startDate, endDate);
}

function generateExport(
  format: string,
  metrics: DailyMetric[],
  portalMap: Map<string, Portal>,
  startDate: string,
  endDate: string
): NextResponse {
  if (format === "json") {
    return NextResponse.json({
      meta: {
        period: { start: startDate, end: endDate },
        record_count: metrics.length,
        generated_at: new Date().toISOString(),
      },
      data: metrics.map(m => ({
        ...m,
        portal_name: portalMap.get(m.portal_id)?.name || "Unknown",
        portal_slug: portalMap.get(m.portal_id)?.slug || "unknown",
      })),
    });
  }

  // CSV format
  const headers = [
    "date",
    "portal_id",
    "portal_name",
    "portal_slug",
    "event_views",
    "event_rsvps",
    "event_saves",
    "event_shares",
    "new_signups",
    "active_users",
    "events_total",
    "events_created",
    "sources_active",
    "crawl_runs",
    "crawl_success_rate",
  ];

  const rows = metrics.map(m => [
    m.date,
    m.portal_id,
    portalMap.get(m.portal_id)?.name || "Unknown",
    portalMap.get(m.portal_id)?.slug || "unknown",
    m.event_views,
    m.event_rsvps,
    m.event_saves,
    m.event_shares,
    m.new_signups,
    m.active_users,
    m.events_total,
    m.events_created,
    m.sources_active,
    m.crawl_runs,
    m.crawl_success_rate,
  ]);

  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="analytics_${startDate}_${endDate}.csv"`,
    },
  });
}

function generateEmptyExport(format: string, startDate: string, endDate: string): NextResponse {
  if (format === "json") {
    return NextResponse.json({
      meta: {
        period: { start: startDate, end: endDate },
        record_count: 0,
        generated_at: new Date().toISOString(),
      },
      data: [],
    });
  }

  const headers = [
    "date",
    "portal_id",
    "portal_name",
    "portal_slug",
    "event_views",
    "event_rsvps",
    "event_saves",
    "event_shares",
    "new_signups",
    "active_users",
    "events_total",
    "events_created",
    "sources_active",
    "crawl_runs",
    "crawl_success_rate",
  ];

  const csv = headers.join(",");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="analytics_${startDate}_${endDate}.csv"`,
    },
  });
}
