import { isAdmin, canManagePortal } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

type SourceWithHealth = {
  id: number;
  name: string;
  slug: string;
  url: string;
  is_active: boolean;
  source_type: string | null;
  health_tags: string[];
  active_months: number[] | null;
  // Health metrics
  last_run: string | null;
  last_status: string | null;
  last_error: string | null;
  success_rate_7d: number;
  events_found_last: number;
  total_events: number;
  // Federation info
  is_owned: boolean;
  owner_portal?: { id: string; name: string; slug: string } | null;
};

type HealthSummary = {
  total: number;
  healthy: number;
  warning: number;
  failing: number;
};

type SourceRow = {
  id: number;
  name: string;
  slug: string;
  url: string;
  is_active: boolean;
  source_type: string | null;
  health_tags: string[] | null;
  active_months: number[] | null;
  owner_portal_id: string | null;
  owner_portal?: { id: string; name: string; slug: string } | null;
};

type CrawlLogRow = {
  source_id: number;
  started_at: string;
  status: string | null;
  events_found: number;
  error_message: string | null;
};

type EventCountRow = {
  source_id: number | null;
};

// GET /api/admin/portals/[id]/sources/health - Get health data for portal's sources
export async function GET(request: NextRequest, { params }: Props) {
  const { id: portalId } = await params;

  // Verify user can manage this portal
  if (!(await canManagePortal(portalId)) && !(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supabase = createServiceClient();

  // Verify portal exists
  const { data: portal, error: portalError } = await supabase
    .from("portals")
    .select("id, slug, name")
    .eq("id", portalId)
    .maybeSingle();

  if (portalError || !portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  // Get owned sources (sources owned by this portal)
  const { data: ownedSourcesData, error: ownedError } = await supabase
    .from("sources")
    .select(`
      id, name, slug, url, is_active, source_type, health_tags, active_months,
      owner_portal_id
    `)
    .eq("owner_portal_id", portalId)
    .order("name");

  if (ownedError) {
    logger.error("Error fetching owned sources:", ownedError);
    return NextResponse.json({ error: "Failed to fetch owned sources" }, { status: 500 });
  }

  const ownedSourcesTyped = (ownedSourcesData || []) as unknown as SourceRow[];

  // Get subscribed sources
  const { data: subscriptionsData, error: subsError } = await supabase
    .from("source_subscriptions")
    .select(`
      id,
      source:sources!source_subscriptions_source_id_fkey(
        id, name, slug, url, is_active, source_type, health_tags, active_months, owner_portal_id,
        owner_portal:portals!sources_owner_portal_id_fkey(id, name, slug)
      )
    `)
    .eq("subscriber_portal_id", portalId)
    .eq("is_active", true);

  if (subsError) {
    logger.error("Error fetching subscriptions:", subsError);
    return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
  }

  // Get source IDs for health data queries
  const ownedSourceIds = ownedSourcesTyped.map((s) => s.id);
  const subscribedSources = (subscriptionsData || [])
    .map((sub) => (sub as { id: string; source: SourceRow }).source)
    .filter(Boolean);
  const subscribedSourceIds = subscribedSources.map((s) => s.id);
  const allSourceIds = [...ownedSourceIds, ...subscribedSourceIds];

  // Get crawl logs from last 7 days for all sources
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let recentLogs: CrawlLogRow[] = [];
  if (allSourceIds.length > 0) {
    const { data } = await supabase
      .from("crawl_logs")
      .select("source_id, started_at, status, events_found, error_message")
      .in("source_id", allSourceIds)
      .gte("started_at", sevenDaysAgo)
      .order("started_at", { ascending: false });
    recentLogs = (data || []) as unknown as CrawlLogRow[];
  }

  // Get event counts per source
  let eventCounts: EventCountRow[] = [];
  if (allSourceIds.length > 0) {
    const { data } = await supabase
      .from("events")
      .select("source_id")
      .in("source_id", allSourceIds)
      .eq("is_active", true);
    eventCounts = (data || []) as unknown as EventCountRow[];
  }

  // Count events per source
  const eventCountMap = new Map<number, number>();
  for (const e of eventCounts) {
    if (e.source_id) {
      eventCountMap.set(e.source_id, (eventCountMap.get(e.source_id) || 0) + 1);
    }
  }

  // Process logs by source
  const logsBySource = new Map<number, CrawlLogRow[]>();
  for (const log of recentLogs) {
    if (!logsBySource.has(log.source_id)) {
      logsBySource.set(log.source_id, []);
    }
    logsBySource.get(log.source_id)!.push(log);
  }

  // Build health data for owned sources
  const ownedSources: SourceWithHealth[] = ownedSourcesTyped.map((source) => {
    return buildSourceHealth(source, logsBySource, eventCountMap, true, null);
  });

  // Build health data for subscribed sources
  const subscribedSourcesWithHealth: SourceWithHealth[] = subscribedSources.map((source) => {
    return buildSourceHealth(source, logsBySource, eventCountMap, false, source.owner_portal || null);
  });

  // Calculate summaries
  const ownedSummary = calculateSummary(ownedSources);
  const subscribedSummary = calculateSummary(subscribedSourcesWithHealth);

  return NextResponse.json({
    ownedSources,
    subscribedSources: subscribedSourcesWithHealth,
    summary: {
      owned: ownedSummary,
      subscribed: subscribedSummary,
    },
  });
}

function buildSourceHealth(
  source: SourceRow,
  logsBySource: Map<number, CrawlLogRow[]>,
  eventCountMap: Map<number, number>,
  isOwned: boolean,
  ownerPortal: { id: string; name: string; slug: string } | null
): SourceWithHealth {
  const logs = logsBySource.get(source.id) || [];
  const lastLog = logs[0];

  const successfulRuns = logs.filter((l) => l.status === "success").length;
  const totalRuns = logs.length;
  const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0;

  return {
    id: source.id,
    name: source.name,
    slug: source.slug,
    url: source.url,
    is_active: source.is_active,
    source_type: source.source_type,
    health_tags: source.health_tags || [],
    active_months: source.active_months,
    last_run: lastLog?.started_at || null,
    last_status: lastLog?.status || null,
    last_error: lastLog?.error_message || null,
    success_rate_7d: successRate,
    events_found_last: lastLog?.events_found || 0,
    total_events: eventCountMap.get(source.id) || 0,
    is_owned: isOwned,
    owner_portal: ownerPortal,
  };
}

function calculateSummary(sources: SourceWithHealth[]): HealthSummary {
  const activeSources = sources.filter((s) => s.is_active);

  return {
    total: sources.length,
    healthy: activeSources.filter((s) => s.success_rate_7d >= 80 && s.last_run).length,
    warning: activeSources.filter(
      (s) => s.success_rate_7d > 0 && s.success_rate_7d < 80
    ).length,
    failing: activeSources.filter(
      (s) => s.success_rate_7d === 0 || s.last_status === "error" || !s.last_run
    ).length,
  };
}
