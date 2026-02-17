import { isAdmin } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { errorApiResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

type SourceHealthMetrics = {
  source_id: number;
  slug: string;
  name: string;
  owner_portal_id: string | null;
  owner_portal_name: string | null;
  last_crawled_at: string | null;
  event_count: number;
  upcoming_event_count: number;
  is_stale: boolean;
};

/**
 * GET /api/admin/source-health
 *
 * Returns source crawler health metrics.
 * Requires admin authentication.
 *
 * Query params:
 * - portal_id: Filter by portal (optional)
 */
export async function GET(request: NextRequest) {
  // Rate limit
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    // Auth check
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const portalIdFilter = searchParams.get("portal_id");

    // Use service client for aggregation queries
    const serviceClient = createServiceClient();

    // 1. Get all sources with portal info
    let sourcesQuery = serviceClient
      .from("sources")
      .select(`
        id,
        slug,
        name,
        is_active,
        owner_portal_id,
        owner_portal:portals!sources_owner_portal_id_fkey(id, name, slug)
      `)
      .eq("is_active", true);

    if (portalIdFilter) {
      sourcesQuery = sourcesQuery.eq("owner_portal_id", portalIdFilter);
    }

    const { data: sources, error: sourcesError } = await sourcesQuery.order("name");

    if (sourcesError) {
      console.error("Error fetching sources:", sourcesError);
      return errorApiResponse("Failed to fetch sources", 500);
    }

    if (!sources || sources.length === 0) {
      return NextResponse.json({ sources: [], summary: { total: 0, stale: 0, healthy: 0 } });
    }

    // 2. Get crawl logs (last 30 days) for these sources
    const sourceIds = sources.map((s) => (s as { id: number }).id);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: crawlLogs, error: logsError } = await serviceClient
      .from("crawl_logs")
      .select("source_id, started_at, status")
      .in("source_id", sourceIds)
      .gte("started_at", thirtyDaysAgo)
      .order("started_at", { ascending: false });

    if (logsError) {
      console.error("Error fetching crawl logs:", logsError);
      // Non-critical - continue without crawl data
    }

    // 3. Get event counts per source
    const { data: events, error: eventsError } = await serviceClient
      .from("events")
      .select("source_id, start_date")
      .in("source_id", sourceIds)
      .eq("is_active", true);

    if (eventsError) {
      console.error("Error fetching events:", eventsError);
      return errorApiResponse("Failed to fetch events", 500);
    }

    // Build crawl log map (latest crawl per source)
    const lastCrawlMap = new Map<number, string>();
    if (crawlLogs) {
      for (const log of crawlLogs as { source_id: number; started_at: string }[]) {
        if (!lastCrawlMap.has(log.source_id)) {
          lastCrawlMap.set(log.source_id, log.started_at);
        }
      }
    }

    // Build event count maps
    const eventCountMap = new Map<number, number>();
    const upcomingEventCountMap = new Map<number, number>();
    const now = new Date();

    if (events) {
      for (const event of events as { source_id: number | null; start_date: string }[]) {
        if (!event.source_id) continue;

        // Total count
        eventCountMap.set(event.source_id, (eventCountMap.get(event.source_id) || 0) + 1);

        // Upcoming count
        if (new Date(event.start_date) > now) {
          upcomingEventCountMap.set(event.source_id, (upcomingEventCountMap.get(event.source_id) || 0) + 1);
        }
      }
    }

    // Calculate stale threshold (3 days ago)
    const staleThreshold = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    // Build health metrics
    const healthMetrics: SourceHealthMetrics[] = sources.map((source) => {
      const sourceData = source as {
        id: number;
        slug: string;
        name: string;
        owner_portal_id: string | null;
        owner_portal: { name: string } | null;
      };

      const lastCrawl = lastCrawlMap.get(sourceData.id) || null;
      const isStale = !lastCrawl || new Date(lastCrawl) < staleThreshold;

      return {
        source_id: sourceData.id,
        slug: sourceData.slug,
        name: sourceData.name,
        owner_portal_id: sourceData.owner_portal_id,
        owner_portal_name: sourceData.owner_portal?.name || null,
        last_crawled_at: lastCrawl,
        event_count: eventCountMap.get(sourceData.id) || 0,
        upcoming_event_count: upcomingEventCountMap.get(sourceData.id) || 0,
        is_stale: isStale,
      };
    });

    // Sort: stale first, then by last crawl (oldest first)
    healthMetrics.sort((a, b) => {
      if (a.is_stale !== b.is_stale) {
        return a.is_stale ? -1 : 1;
      }
      if (!a.last_crawled_at && !b.last_crawled_at) return 0;
      if (!a.last_crawled_at) return -1;
      if (!b.last_crawled_at) return 1;
      return new Date(a.last_crawled_at).getTime() - new Date(b.last_crawled_at).getTime();
    });

    // Summary stats
    const summary = {
      total: healthMetrics.length,
      stale: healthMetrics.filter((s) => s.is_stale).length,
      healthy: healthMetrics.filter((s) => !s.is_stale).length,
      never_crawled: healthMetrics.filter((s) => !s.last_crawled_at).length,
      with_upcoming_events: healthMetrics.filter((s) => s.upcoming_event_count > 0).length,
    };

    return NextResponse.json({
      sources: healthMetrics,
      summary,
    });
  } catch (error) {
    console.error("Error in GET /api/admin/source-health:", error);
    return errorApiResponse("Internal server error", 500);
  }
}
