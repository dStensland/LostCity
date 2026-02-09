import { NextRequest, NextResponse } from "next/server";
import { createClient, canManagePortal } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api-utils";

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

  // Fetch all page views in the window
  const { data: views, error: viewsError } = await supabase
    .from("portal_page_views")
    .select("page_type, entity_id, utm_source, utm_medium, user_agent, created_at")
    .eq("portal_id", portalData.id)
    .gte("created_at", sinceISO)
    .order("created_at", { ascending: true })
    .limit(10000);

  if (viewsError) {
    return errorResponse(viewsError, "portal analytics");
  }

  const allViews = (views || []) as {
    page_type: string;
    entity_id: number | null;
    utm_source: string | null;
    utm_medium: string | null;
    user_agent: string | null;
    created_at: string;
  }[];

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

  return NextResponse.json({
    period: { days, since: sinceISO },
    kpis: {
      total_views: totalViews,
      unique_visitors: uniqueVisitors,
      qr_scans: qrScans,
      views_by_type: viewsByType,
    },
    time_series: timeSeries,
    top_events: topEvents,
    utm_sources: utmSources,
  });
}
