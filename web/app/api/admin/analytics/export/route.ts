import { supabase } from "@/lib/supabase";
import { isAdmin } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type DailyMetric = {
  date: string;
  portal_id: string;
  event_views: number;
  event_rsvps: number;
  event_saves: number;
  event_shares: number;
  new_signups: number;
  active_users: number;
  events_total: number;
  events_created: number;
  sources_active: number;
  crawl_runs: number;
  crawl_success_rate: number;
};

type Portal = {
  id: string;
  name: string;
  slug: string;
};

export async function GET(request: NextRequest) {
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
  const endDate = endDateParam || new Date().toISOString().split("T")[0];
  const startDate = startDateParam || (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
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
    .select("*")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true })
    .order("portal_id", { ascending: true });

  if (portalId) {
    query = query.eq("portal_id", portalId);
  }

  const { data: analyticsData, error } = await query;

  if (error) {
    // If table doesn't exist, return empty
    return generateEmptyExport(format, startDate, endDate);
  }

  const metrics = (analyticsData || []) as DailyMetric[];

  // If no data, generate from source tables
  if (metrics.length === 0) {
    const computedMetrics = await computeExportMetrics(startDate, endDate, portalId, portals as Portal[] || []);
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

async function computeExportMetrics(
  startDate: string,
  endDate: string,
  portalId: string | null,
  portals: Portal[]
): Promise<DailyMetric[]> {
  const metrics: DailyMetric[] = [];

  // Get RSVPs by date
  const { data: rsvps } = await supabase
    .from("event_rsvps")
    .select("created_at")
    .gte("created_at", startDate)
    .lte("created_at", endDate + "T23:59:59");

  // Get signups by date
  const { data: profiles } = await supabase
    .from("profiles")
    .select("created_at")
    .gte("created_at", startDate)
    .lte("created_at", endDate + "T23:59:59");

  // Get activities by date
  const { data: activities } = await supabase
    .from("activities")
    .select("created_at, user_id")
    .gte("created_at", startDate)
    .lte("created_at", endDate + "T23:59:59");

  // Get crawl stats
  const { data: crawlLogs } = await supabase
    .from("crawl_logs")
    .select("started_at, status")
    .gte("started_at", startDate)
    .lte("started_at", endDate + "T23:59:59");

  // Group by date
  const rsvpsByDate = new Map<string, number>();
  for (const r of (rsvps || [])) {
    const date = (r as { created_at: string }).created_at.split("T")[0];
    rsvpsByDate.set(date, (rsvpsByDate.get(date) || 0) + 1);
  }

  const signupsByDate = new Map<string, number>();
  for (const p of (profiles || [])) {
    const date = (p as { created_at: string }).created_at.split("T")[0];
    signupsByDate.set(date, (signupsByDate.get(date) || 0) + 1);
  }

  const activeUsersByDate = new Map<string, Set<string>>();
  for (const a of (activities || [])) {
    const act = a as { created_at: string; user_id: string };
    const date = act.created_at.split("T")[0];
    if (!activeUsersByDate.has(date)) {
      activeUsersByDate.set(date, new Set());
    }
    activeUsersByDate.get(date)!.add(act.user_id);
  }

  const crawlsByDate = new Map<string, { runs: number; success: number }>();
  for (const c of (crawlLogs || [])) {
    const log = c as { started_at: string; status: string };
    const date = log.started_at.split("T")[0];
    const existing = crawlsByDate.get(date) || { runs: 0, success: 0 };
    existing.runs++;
    if (log.status === "success") existing.success++;
    crawlsByDate.set(date, existing);
  }

  // Generate date range
  const start = new Date(startDate);
  const end = new Date(endDate);
  const current = new Date(start);

  const targetPortals = portalId
    ? portals.filter(p => p.id === portalId)
    : portals;

  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0];

    for (const portal of targetPortals) {
      const crawlStats = crawlsByDate.get(dateStr) || { runs: 0, success: 0 };
      const successRate = crawlStats.runs > 0
        ? (crawlStats.success / crawlStats.runs) * 100
        : 0;

      metrics.push({
        date: dateStr,
        portal_id: portal.id,
        event_views: 0,
        event_rsvps: rsvpsByDate.get(dateStr) || 0,
        event_saves: 0,
        event_shares: 0,
        new_signups: signupsByDate.get(dateStr) || 0,
        active_users: activeUsersByDate.get(dateStr)?.size || 0,
        events_total: 0,
        events_created: 0,
        sources_active: 0,
        crawl_runs: crawlStats.runs,
        crawl_success_rate: successRate,
      });
    }

    current.setDate(current.getDate() + 1);
  }

  return metrics;
}
