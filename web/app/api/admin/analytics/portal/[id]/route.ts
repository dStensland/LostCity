import { createClient } from "@/lib/supabase/server";
import { isAdmin, canManagePortal } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getLocalDateString } from "@/lib/formats";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { computeAttributedDailyMetrics, type DailyMetric } from "@/lib/analytics/attributed-metrics";
import type { AnySupabase } from "@/lib/api-utils";
import { fetchPortalInteractionRows, summarizeInteractionRows } from "@/lib/analytics/portal-interaction-metrics";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
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
  const endDateStr = getLocalDateString();
  const startTimestamp = `${startDateStr}T00:00:00`;
  const endTimestamp = `${endDateStr}T23:59:59.999`;

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
    .select("date, portal_id, event_views, event_rsvps, event_saves, event_shares, new_signups, active_users, events_total, events_created, sources_active, crawl_runs, crawl_success_rate")
    .eq("portal_id", portalId)
    .gte("date", startDateStr)
    .lte("date", endDateStr)
    .order("date", { ascending: true });

  let metrics: DailyMetric[] = [];

  if (analyticsError || !analyticsData || analyticsData.length === 0) {
    metrics = await computeAttributedDailyMetrics(supabase, {
      portalIds: [portalId],
      startDate: startDateStr,
      endDate: endDateStr,
    });
  } else {
    metrics = (analyticsData as DailyMetric[]).map((row) => ({
      ...row,
      portal_id: portalId,
    }));
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
  const sharesPerThousandViews = totalViews > 0
    ? Number(((totalShares / totalViews) * 1000).toFixed(1))
    : 0;

  let interactionSummary = {
    total_interactions: 0,
    mode_selected: 0,
    wayfinding_opened: 0,
    resource_clicked: 0,
    wayfinding_open_rate: 0,
    resource_click_rate: 0,
    conversion_action_rail_clicks: 0,
    conversion_action_rail_click_rate: 0,
    conversion_action_rail_by_mode: [] as Array<{
      mode: string;
      clicks: number;
      mode_selections: number;
      ctr: number | null;
    }>,
    conversion_action_rail_by_target_kind: [] as Array<{ target_kind: string; clicks: number }>,
    mode_breakdown: [] as Array<{ mode: string; count: number }>,
    interactions_by_day: [] as Array<{ date: string; count: number }>,
  };

  try {
    const rows = await fetchPortalInteractionRows(
      supabase as unknown as AnySupabase,
      {
        portalIds: [portalId],
        startTimestamp,
        endTimestamp,
      }
    );
    interactionSummary = summarizeInteractionRows(rows, totalViews);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("does not exist")) {
      return NextResponse.json({ error: "Failed to fetch interaction analytics" }, { status: 500 });
    }
  }

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
    interactions: interactionSummary.interactions_by_day.map((m) => ({ date: m.date, value: m.count })),
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
      end: endDateStr,
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
    attribution: {
      tracked_event_shares: totalShares,
      shares_per_1k_views: sharesPerThousandViews,
      attributed_signups: totalSignups,
    },
    interaction_kpis: {
      total_interactions: interactionSummary.total_interactions,
      mode_selected: interactionSummary.mode_selected,
      wayfinding_opened: interactionSummary.wayfinding_opened,
      resource_clicked: interactionSummary.resource_clicked,
      wayfinding_open_rate: interactionSummary.wayfinding_open_rate,
      resource_click_rate: interactionSummary.resource_click_rate,
      conversion_action_rail_clicks: interactionSummary.conversion_action_rail_clicks,
      conversion_action_rail_click_rate: interactionSummary.conversion_action_rail_click_rate,
      conversion_action_rail_by_mode: interactionSummary.conversion_action_rail_by_mode,
      conversion_action_rail_by_target_kind: interactionSummary.conversion_action_rail_by_target_kind,
      mode_breakdown: interactionSummary.mode_breakdown,
    },
    content: contentStats,
    time_series: timeSeries,
  });
}
