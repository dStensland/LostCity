import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getLocalDateString } from "@/lib/formats";
import { adminErrorResponse, type AnySupabase } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { computeAttributedDailyMetrics, type DailyMetric } from "@/lib/analytics/attributed-metrics";
import {
  fetchPortalInteractionRows,
  summarizeInteractionRows,
  summarizeRowsByPortal,
} from "@/lib/analytics/portal-interaction-metrics";

export const dynamic = "force-dynamic";

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
  mode_selected: number;
  wayfinding_opened: number;
  resource_clicked: number;
};

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();

  // Verify admin
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams;
  const daysParam = searchParams.get("days");
  const portalId = searchParams.get("portal_id");

  const days = Math.min(Math.max(parseInt(daysParam || "30", 10) || 30, 1), 365);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = getLocalDateString(startDate);
  const endDateStr = getLocalDateString();
  const startTimestamp = `${startDateStr}T00:00:00`;
  const endTimestamp = `${endDateStr}T23:59:59.999`;

  // Get portals
  const { data: portals, error: portalsError } = await supabase
    .from("portals")
    .select("id, name, slug, status")
    .eq("status", "active")
    .order("name");

  if (portalsError) {
    return adminErrorResponse(portalsError, "GET /api/admin/analytics - portals query");
  }

  const activePortals = (portals as Portal[]) || [];
  const targetPortalIds = portalId
    ? activePortals.filter((p) => p.id === portalId).map((p) => p.id)
    : activePortals.map((p) => p.id);

  // Build analytics query
  let analyticsQuery = supabase
    .from("analytics_daily_portal")
    .select("date, portal_id, event_views, event_rsvps, event_saves, event_shares, new_signups, active_users, events_total, events_created, sources_active, crawl_runs, crawl_success_rate")
    .gte("date", startDateStr)
    .lte("date", endDateStr)
    .order("date", { ascending: true });

  if (portalId) {
    analyticsQuery = analyticsQuery.eq("portal_id", portalId);
  }

  const { data: analyticsData, error: analyticsError } = await analyticsQuery;

  // If analytics table doesn't exist or has no rows for this range, compute from attributed source tables.
  let metrics: DailyMetric[] = (analyticsData as DailyMetric[]) || [];

  if (analyticsError || metrics.length === 0) {
    metrics = await computeAttributedDailyMetrics(supabase, {
      portalIds: targetPortalIds,
      startDate: startDateStr,
      endDate: endDateStr,
    });
  }

  // Aggregate KPIs
  const totalViews = metrics.reduce((sum, m) => sum + (m.event_views || 0), 0);
  const totalRsvps = metrics.reduce((sum, m) => sum + (m.event_rsvps || 0), 0);
  const totalShares = metrics.reduce((sum, m) => sum + (m.event_shares || 0), 0);
  const totalSignups = metrics.reduce((sum, m) => sum + (m.new_signups || 0), 0);
  const avgActiveUsers = metrics.length > 0
    ? Math.round(metrics.reduce((sum, m) => sum + (m.active_users || 0), 0) / metrics.length)
    : 0;

  let rawNewProfiles: number | null = null;
  if (!portalId) {
    const { count, error: profileCountError } = await supabase
      .from("profiles")
      .select("id", { head: true, count: "exact" })
      .gte("created_at", `${startDateStr}T00:00:00`)
      .lte("created_at", `${endDateStr}T23:59:59.999`);

    if (!profileCountError) {
      rawNewProfiles = count ?? 0;
    }
  }

  const unattributedSignups = rawNewProfiles === null
    ? null
    : Math.max(rawNewProfiles - totalSignups, 0);
  const signupAttributionRate = rawNewProfiles && rawNewProfiles > 0
    ? Number(((totalSignups / rawNewProfiles) * 100).toFixed(1))
    : null;
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
    mode_breakdown: [] as Array<{ mode: string; count: number }>,
    interactions_by_day: [] as Array<{ date: string; count: number }>,
  };

  let interactionsByPortal = new Map<string, {
    total_interactions: number;
    mode_selected: number;
    wayfinding_opened: number;
    resource_clicked: number;
    mode_breakdown: Array<{ mode: string; count: number }>;
    interactions_by_day: Array<{ date: string; count: number }>;
  }>();

  try {
    const rows = await fetchPortalInteractionRows(
      supabase as unknown as AnySupabase,
      {
        portalIds: targetPortalIds,
        startTimestamp,
        endTimestamp,
      }
    );
    interactionSummary = summarizeInteractionRows(rows, totalViews);
    interactionsByPortal = summarizeRowsByPortal(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("does not exist")) {
      return adminErrorResponse(error, "GET /api/admin/analytics - interaction query");
    }
  }

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
        mode_selected: interactionsByPortal.get(pid)?.mode_selected || 0,
        wayfinding_opened: interactionsByPortal.get(pid)?.wayfinding_opened || 0,
        resource_clicked: interactionsByPortal.get(pid)?.resource_clicked || 0,
      });
    }

    // Sort by views descending
    portalSummaries.sort((a, b) => b.total_views - a.total_views);
  }

  return NextResponse.json({
    period: {
      start: startDateStr,
      end: endDateStr,
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
    attribution: {
      scope: portalId ? "portal" : "platform",
      raw_new_profiles: rawNewProfiles,
      attributed_signups: totalSignups,
      unattributed_signups: unattributedSignups,
      signup_attribution_rate: signupAttributionRate,
      tracked_event_shares: totalShares,
      shares_per_1k_views: sharesPerThousandViews,
    },
    interaction_kpis: {
      total_interactions: interactionSummary.total_interactions,
      mode_selected: interactionSummary.mode_selected,
      wayfinding_opened: interactionSummary.wayfinding_opened,
      resource_clicked: interactionSummary.resource_clicked,
      wayfinding_open_rate: interactionSummary.wayfinding_open_rate,
      resource_click_rate: interactionSummary.resource_click_rate,
      mode_breakdown: interactionSummary.mode_breakdown,
    },
    interaction_time_series: interactionSummary.interactions_by_day,
    time_series: timeSeries,
    portals: portalSummaries,
    portal_count: activePortals.length,
  });
}
