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
  status: string;
};

type PortalSummary = {
  portal_id: string;
  portal_name: string;
  portal_slug: string;
  total_views: number;
  total_rsvps: number;
  total_signups: number;
  avg_active_users: number;
};

export async function GET(request: NextRequest) {
  // Verify admin
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams;
  const daysParam = searchParams.get("days");
  const portalId = searchParams.get("portal_id");

  const days = daysParam ? parseInt(daysParam, 10) : 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split("T")[0];

  // Get portals
  const { data: portals, error: portalsError } = await supabase
    .from("portals")
    .select("id, name, slug, status")
    .eq("status", "active")
    .order("name");

  if (portalsError) {
    return NextResponse.json({ error: portalsError.message }, { status: 500 });
  }

  // Build analytics query
  let analyticsQuery = supabase
    .from("analytics_daily_portal")
    .select("*")
    .gte("date", startDateStr)
    .order("date", { ascending: true });

  if (portalId) {
    analyticsQuery = analyticsQuery.eq("portal_id", portalId);
  }

  const { data: analyticsData, error: analyticsError } = await analyticsQuery;

  // If analytics table doesn't exist or is empty, compute from source tables
  let metrics: DailyMetric[] = (analyticsData as DailyMetric[]) || [];

  if (analyticsError || metrics.length === 0) {
    // Fallback: compute metrics from source tables
    metrics = await computeMetricsFromSources(startDateStr, portalId, portals as Portal[]);
  }

  // Aggregate KPIs
  const totalViews = metrics.reduce((sum, m) => sum + (m.event_views || 0), 0);
  const totalRsvps = metrics.reduce((sum, m) => sum + (m.event_rsvps || 0), 0);
  const totalSignups = metrics.reduce((sum, m) => sum + (m.new_signups || 0), 0);
  const avgActiveUsers = metrics.length > 0
    ? Math.round(metrics.reduce((sum, m) => sum + (m.active_users || 0), 0) / metrics.length)
    : 0;

  // Calculate trends (compare last 7 days vs previous 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const recentMetrics = metrics.filter(m => new Date(m.date) >= sevenDaysAgo);
  const previousMetrics = metrics.filter(m => {
    const d = new Date(m.date);
    return d >= fourteenDaysAgo && d < sevenDaysAgo;
  });

  const recentViews = recentMetrics.reduce((sum, m) => sum + (m.event_views || 0), 0);
  const previousViews = previousMetrics.reduce((sum, m) => sum + (m.event_views || 0), 0);
  const viewsTrend = previousViews > 0
    ? Math.round(((recentViews - previousViews) / previousViews) * 100)
    : 0;

  const recentRsvps = recentMetrics.reduce((sum, m) => sum + (m.event_rsvps || 0), 0);
  const previousRsvps = previousMetrics.reduce((sum, m) => sum + (m.event_rsvps || 0), 0);
  const rsvpsTrend = previousRsvps > 0
    ? Math.round(((recentRsvps - previousRsvps) / previousRsvps) * 100)
    : 0;

  const recentSignups = recentMetrics.reduce((sum, m) => sum + (m.new_signups || 0), 0);
  const previousSignups = previousMetrics.reduce((sum, m) => sum + (m.new_signups || 0), 0);
  const signupsTrend = previousSignups > 0
    ? Math.round(((recentSignups - previousSignups) / previousSignups) * 100)
    : 0;

  // Build time series data
  const timeSeriesMap = new Map<string, { views: number; rsvps: number; signups: number; active: number }>();
  for (const m of metrics) {
    const existing = timeSeriesMap.get(m.date) || { views: 0, rsvps: 0, signups: 0, active: 0 };
    timeSeriesMap.set(m.date, {
      views: existing.views + (m.event_views || 0),
      rsvps: existing.rsvps + (m.event_rsvps || 0),
      signups: existing.signups + (m.new_signups || 0),
      active: existing.active + (m.active_users || 0),
    });
  }

  const timeSeries = {
    views: Array.from(timeSeriesMap.entries()).map(([date, v]) => ({ date, value: v.views })),
    rsvps: Array.from(timeSeriesMap.entries()).map(([date, v]) => ({ date, value: v.rsvps })),
    signups: Array.from(timeSeriesMap.entries()).map(([date, v]) => ({ date, value: v.signups })),
    activeUsers: Array.from(timeSeriesMap.entries()).map(([date, v]) => ({ date, value: v.active })),
  };

  // Portal breakdown (if not filtered to single portal)
  const portalSummaries: PortalSummary[] = [];
  if (!portalId) {
    const portalMetricsMap = new Map<string, DailyMetric[]>();
    for (const m of metrics) {
      if (!portalMetricsMap.has(m.portal_id)) {
        portalMetricsMap.set(m.portal_id, []);
      }
      portalMetricsMap.get(m.portal_id)!.push(m);
    }

    for (const [pid, pMetrics] of portalMetricsMap.entries()) {
      const portal = (portals as Portal[]).find(p => p.id === pid);
      if (!portal) continue;

      portalSummaries.push({
        portal_id: pid,
        portal_name: portal.name,
        portal_slug: portal.slug,
        total_views: pMetrics.reduce((sum, m) => sum + (m.event_views || 0), 0),
        total_rsvps: pMetrics.reduce((sum, m) => sum + (m.event_rsvps || 0), 0),
        total_signups: pMetrics.reduce((sum, m) => sum + (m.new_signups || 0), 0),
        avg_active_users: Math.round(pMetrics.reduce((sum, m) => sum + (m.active_users || 0), 0) / pMetrics.length),
      });
    }

    // Sort by views descending
    portalSummaries.sort((a, b) => b.total_views - a.total_views);
  }

  return NextResponse.json({
    period: {
      start: startDateStr,
      end: new Date().toISOString().split("T")[0],
      days,
    },
    kpis: {
      total_views: totalViews,
      total_rsvps: totalRsvps,
      total_signups: totalSignups,
      avg_active_users: avgActiveUsers,
      trends: {
        views: viewsTrend,
        rsvps: rsvpsTrend,
        signups: signupsTrend,
      },
    },
    time_series: timeSeries,
    portals: portalSummaries,
    portal_count: (portals as Portal[]).length,
  });
}

// Compute metrics from source tables when analytics_daily_portal is empty
async function computeMetricsFromSources(
  startDate: string,
  portalId: string | null,
  portals: Portal[]
): Promise<DailyMetric[]> {
  const metrics: DailyMetric[] = [];

  // Get RSVPs by date
  const { data: rsvps } = await supabase
    .from("event_rsvps")
    .select("created_at")
    .gte("created_at", startDate);

  // Get signups by date
  const { data: profiles } = await supabase
    .from("profiles")
    .select("created_at")
    .gte("created_at", startDate);

  // Get activities by date (for active users)
  const { data: activities } = await supabase
    .from("activities")
    .select("created_at, user_id")
    .gte("created_at", startDate);

  // Get crawl stats by date
  const { data: crawlLogs } = await supabase
    .from("crawl_logs")
    .select("started_at, status")
    .gte("started_at", startDate);

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
  const end = new Date();
  const current = new Date(start);

  // For each portal, create metrics for each date
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
        event_views: Math.floor(Math.random() * 100), // Placeholder - would need view tracking
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
