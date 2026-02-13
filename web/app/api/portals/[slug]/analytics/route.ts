import { NextRequest, NextResponse } from "next/server";
import { createClient, canManagePortal } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api-utils";
import type { AnySupabase } from "@/lib/api-utils";
import { fetchPortalInteractionRows, summarizeInteractionRows } from "@/lib/analytics/portal-interaction-metrics";

const PAGE_SIZE = 5000;

// GET /api/portals/[slug]/analytics - Portal analytics dashboard data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Rate limit - write tier (30/min) for admin endpoint
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const days = Math.min(parseInt(searchParams.get("days") || "30", 10) || 30, 90);

  const supabase = await createClient();

  // Look up portal
  const { data: portal, error: portalError } = await supabase
    .from("portals")
    .select("id, name")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (portalError || !portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const portalData = portal as { id: string; name: string };

  // Check authorization
  if (!(await canManagePortal(portalData.id))) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);
  const sinceISO = sinceDate.toISOString();
  const nowISO = new Date().toISOString();

  // Fetch all page views in pages to avoid silent truncation at high traffic.
  const allViews: {
    page_type: string;
    entity_id: number | null;
    utm_source: string | null;
    utm_medium: string | null;
    user_agent: string | null;
    created_at: string;
  }[] = [];

  let offset = 0;
  while (true) {
    const { data: pageViews, error: viewsError } = await supabase
      .from("portal_page_views")
      .select("page_type, entity_id, utm_source, utm_medium, user_agent, created_at")
      .eq("portal_id", portalData.id)
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (viewsError) {
      return errorResponse(viewsError, "portal analytics");
    }

    const batch = (pageViews || []) as {
      page_type: string;
      entity_id: number | null;
      utm_source: string | null;
      utm_medium: string | null;
      user_agent: string | null;
      created_at: string;
    }[];

    allViews.push(...batch);
    if (batch.length < PAGE_SIZE) {
      break;
    }
    offset += PAGE_SIZE;
  }

  // KPIs
  const totalViews = allViews.length;
  const uniqueAgents = new Set(allViews.map((v) => v.user_agent).filter(Boolean));
  const uniqueVisitors = uniqueAgents.size;
  const qrScans = allViews.filter((v) => v.utm_medium === "qr").length;

  // Views by page type
  const viewsByType: Record<string, number> = {};
  for (const v of allViews) {
    viewsByType[v.page_type] = (viewsByType[v.page_type] || 0) + 1;
  }

  // Time series: views per day
  const viewsByDay: Record<string, number> = {};
  for (const v of allViews) {
    const day = v.created_at.slice(0, 10);
    viewsByDay[day] = (viewsByDay[day] || 0) + 1;
  }
  const timeSeries = Object.entries(viewsByDay)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Top events by view count
  const eventViewCounts: Record<number, number> = {};
  for (const v of allViews) {
    if (v.page_type === "event" && v.entity_id) {
      eventViewCounts[v.entity_id] = (eventViewCounts[v.entity_id] || 0) + 1;
    }
  }
  const topEvents = Object.entries(eventViewCounts)
    .map(([id, count]) => ({ event_id: parseInt(id, 10), views: count }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  // UTM source breakdown
  const utmBreakdown: Record<string, number> = {};
  for (const v of allViews) {
    if (v.utm_source) {
      utmBreakdown[v.utm_source] = (utmBreakdown[v.utm_source] || 0) + 1;
    }
  }
  const utmSources = Object.entries(utmBreakdown)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

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
    const interactionRows = await fetchPortalInteractionRows(
      supabase as unknown as AnySupabase,
      {
        portalIds: [portalData.id],
        startTimestamp: sinceISO,
        endTimestamp: nowISO,
      }
    );
    interactionSummary = summarizeInteractionRows(interactionRows, totalViews);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("does not exist")) {
      return errorResponse(error, "portal interaction analytics");
    }
  }

  return NextResponse.json({
    period: { days, since: sinceISO },
    kpis: {
      total_views: totalViews,
      unique_visitors: uniqueVisitors,
      qr_scans: qrScans,
      views_by_type: viewsByType,
    },
    time_series: timeSeries,
    interaction_time_series: interactionSummary.interactions_by_day,
    top_events: topEvents,
    utm_sources: utmSources,
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
  });
}
