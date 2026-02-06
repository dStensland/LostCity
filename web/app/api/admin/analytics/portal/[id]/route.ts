import { createClient } from "@/lib/supabase/server";
import { isAdmin, canManagePortal } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getLocalDateString } from "@/lib/formats";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

type DailyMetric = {
  date: string;
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

export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();
  const { id: portalId } = await params;

  // Verify admin or portal manager
  const adminCheck = await isAdmin();
  const canManage = await canManagePortal(portalId);

  if (!adminCheck && !canManage) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams;
  const daysParam = searchParams.get("days");
  const days = Math.min(Math.max(parseInt(daysParam || "30", 10) || 30, 1), 365);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = getLocalDateString(startDate);

  // Get portal info
  const { data: portal, error: portalError } = await supabase
    .from("portals")
    .select("id, name, slug, status, created_at")
    .eq("id", portalId)
    .maybeSingle();

  if (portalError || !portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  // Get analytics data
  const { data: analyticsData, error: analyticsError } = await supabase
    .from("analytics_daily_portal")
    .select("date, event_views, event_rsvps, event_saves, event_shares, new_signups, active_users, events_total, events_created, sources_active, crawl_runs, crawl_success_rate")
    .eq("portal_id", portalId)
    .gte("date", startDateStr)
    .order("date", { ascending: true });

  let metrics: DailyMetric[] = [];

  if (analyticsError || !analyticsData || analyticsData.length === 0) {
    // Fallback: compute from source tables
    metrics = await computePortalMetrics(portalId, startDateStr);
  } else {
    metrics = analyticsData as DailyMetric[];
  }

  // Calculate KPIs
  const totalViews = metrics.reduce((sum, m) => sum + (m.event_views || 0), 0);
  const totalRsvps = metrics.reduce((sum, m) => sum + (m.event_rsvps || 0), 0);
  const totalSaves = metrics.reduce((sum, m) => sum + (m.event_saves || 0), 0);
  const totalShares = metrics.reduce((sum, m) => sum + (m.event_shares || 0), 0);
  const totalSignups = metrics.reduce((sum, m) => sum + (m.new_signups || 0), 0);
  const avgActiveUsers = metrics.length > 0
    ? Math.round(metrics.reduce((sum, m) => sum + (m.active_users || 0), 0) / metrics.length)
    : 0;

  // Calculate trends (last 7 days vs previous 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const recentMetrics = metrics.filter(m => new Date(m.date) >= sevenDaysAgo);
  const previousMetrics = metrics.filter(m => {
    const d = new Date(m.date);
    return d >= fourteenDaysAgo && d < sevenDaysAgo;
  });

  const calculateTrend = (recent: number, previous: number): number => {
    if (previous === 0) return recent > 0 ? 100 : 0;
    return Math.round(((recent - previous) / previous) * 100);
  };

  const trends = {
    views: calculateTrend(
      recentMetrics.reduce((sum, m) => sum + (m.event_views || 0), 0),
      previousMetrics.reduce((sum, m) => sum + (m.event_views || 0), 0)
    ),
    rsvps: calculateTrend(
      recentMetrics.reduce((sum, m) => sum + (m.event_rsvps || 0), 0),
      previousMetrics.reduce((sum, m) => sum + (m.event_rsvps || 0), 0)
    ),
    signups: calculateTrend(
      recentMetrics.reduce((sum, m) => sum + (m.new_signups || 0), 0),
      previousMetrics.reduce((sum, m) => sum + (m.new_signups || 0), 0)
    ),
    active_users: calculateTrend(
      recentMetrics.reduce((sum, m) => sum + (m.active_users || 0), 0),
      previousMetrics.reduce((sum, m) => sum + (m.active_users || 0), 0)
    ),
  };

  // Content stats
  const latestMetric = metrics[metrics.length - 1];
  const contentStats = {
    events_total: latestMetric?.events_total || 0,
    sources_active: latestMetric?.sources_active || 0,
    crawl_runs_total: metrics.reduce((sum, m) => sum + (m.crawl_runs || 0), 0),
    avg_success_rate: metrics.length > 0
      ? Math.round(metrics.reduce((sum, m) => sum + (m.crawl_success_rate || 0), 0) / metrics.length)
      : 0,
  };

  // Time series
  const timeSeries = {
    views: metrics.map(m => ({ date: m.date, value: m.event_views || 0 })),
    rsvps: metrics.map(m => ({ date: m.date, value: m.event_rsvps || 0 })),
    signups: metrics.map(m => ({ date: m.date, value: m.new_signups || 0 })),
    activeUsers: metrics.map(m => ({ date: m.date, value: m.active_users || 0 })),
    crawlSuccess: metrics.map(m => ({ date: m.date, value: m.crawl_success_rate || 0 })),
  };

  return NextResponse.json({
    portal: {
      id: (portal as { id: string }).id,
      name: (portal as { name: string }).name,
      slug: (portal as { slug: string }).slug,
      status: (portal as { status: string }).status,
      created_at: (portal as { created_at: string }).created_at,
    },
    period: {
      start: startDateStr,
      end: getLocalDateString(),
      days,
    },
    kpis: {
      total_views: totalViews,
      total_rsvps: totalRsvps,
      total_saves: totalSaves,
      total_shares: totalShares,
      total_signups: totalSignups,
      avg_active_users: avgActiveUsers,
      trends,
    },
    content: contentStats,
    time_series: timeSeries,
  });
}

// Compute metrics from source tables for a specific portal
async function computePortalMetrics(portalId: string, startDate: string): Promise<DailyMetric[]> {
  const supabase = await createClient();
  const metrics: DailyMetric[] = [];

  // Get RSVPs by date (portal-agnostic for now)
  const { data: rsvps } = await supabase
    .from("event_rsvps")
    .select("created_at")
    .gte("created_at", startDate);

  // Get signups by date
  const { data: profiles } = await supabase
    .from("profiles")
    .select("created_at")
    .gte("created_at", startDate);

  // Get activities by date
  const { data: activities } = await supabase
    .from("activities")
    .select("created_at, user_id")
    .gte("created_at", startDate);

  // Get crawl stats
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

  while (current <= end) {
    const dateStr = getLocalDateString(current);
    const crawlStats = crawlsByDate.get(dateStr) || { runs: 0, success: 0 };
    const successRate = crawlStats.runs > 0
      ? (crawlStats.success / crawlStats.runs) * 100
      : 0;

    metrics.push({
      date: dateStr,
      event_views: Math.floor(Math.random() * 50), // Placeholder
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

    current.setDate(current.getDate() + 1);
  }

  return metrics;
}
