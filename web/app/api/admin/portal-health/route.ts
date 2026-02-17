import { isAdmin } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { errorApiResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

type PortalHealthMetrics = {
  portal_id: string;
  slug: string;
  name: string;
  status: string;
  total_events: number;
  upcoming_events: number;
  events_with_images: number;
  total_venues: number;
  total_sources: number;
  last_crawl_at: string | null;
  stale_sources: number;
};

/**
 * GET /api/admin/portal-health
 *
 * Returns health metrics for all active portals.
 * Requires admin authentication.
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

    // Use service client for aggregation queries
    const serviceClient = createServiceClient();

    // 1. Get all portals
    const { data: portals, error: portalsError } = await serviceClient
      .from("portals")
      .select("id, slug, name, status")
      .order("name");

    if (portalsError) {
      console.error("Error fetching portals:", portalsError);
      return errorApiResponse("Failed to fetch portals", 500);
    }

    if (!portals || portals.length === 0) {
      return NextResponse.json({ portals: [], summary: { total: 0, active: 0 } });
    }

    // 2. Get event counts per portal
    // Strategy: events are associated with portals via sources (sources.owner_portal_id)
    // or directly (events.portal_id), or by city match
    const { data: allEvents, error: eventsError } = await serviceClient
      .from("events")
      .select("id, portal_id, source_id, image_url, start_date");

    if (eventsError) {
      console.error("Error fetching events:", eventsError);
      return errorApiResponse("Failed to fetch events", 500);
    }

    // 3. Get sources with portal associations
    const { data: sources, error: sourcesError } = await serviceClient
      .from("sources")
      .select("id, owner_portal_id, is_active");

    if (sourcesError) {
      console.error("Error fetching sources:", sourcesError);
      return errorApiResponse("Failed to fetch sources", 500);
    }

    // 4. Get crawl logs (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: crawlLogs, error: logsError } = await serviceClient
      .from("crawl_logs")
      .select("source_id, started_at")
      .gte("started_at", thirtyDaysAgo)
      .order("started_at", { ascending: false });

    if (logsError) {
      console.error("Error fetching crawl logs:", logsError);
      // Non-critical - continue without crawl data
    }


    // Build source-to-portal map
    const sourcePortalMap = new Map<number, string | null>();
    const portalSourceCounts = new Map<string, number>();
    const portalActiveSources = new Map<string, Set<number>>();

    type SourceRow = { id: number; owner_portal_id: string | null; is_active: boolean };

    if (sources) {
      for (const source of sources as SourceRow[]) {
        sourcePortalMap.set(source.id, source.owner_portal_id);

        if (source.is_active && source.owner_portal_id) {
          portalSourceCounts.set(
            source.owner_portal_id,
            (portalSourceCounts.get(source.owner_portal_id) || 0) + 1
          );

          if (!portalActiveSources.has(source.owner_portal_id)) {
            portalActiveSources.set(source.owner_portal_id, new Set());
          }
          portalActiveSources.get(source.owner_portal_id)!.add(source.id);
        }
      }
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

    // Calculate stale threshold (3 days ago)
    const staleThreshold = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    // Build portal metrics
    const now = new Date();

    type PortalRow = { id: string; slug: string; name: string; status: string };

    const healthMetrics: PortalHealthMetrics[] = (portals as PortalRow[]).map((portal) => {
      const portalId = portal.id;
      const portalSources = portalActiveSources.get(portalId) || new Set<number>();

      // Filter events for this portal
      const portalEvents = (allEvents || []).filter((e) => {
        const event = e as { portal_id: string | null; source_id: number | null };
        // Event belongs to portal if: portal_id matches OR source's owner_portal_id matches OR portal_id is null (global)
        if (event.portal_id === portalId) return true;
        if (event.source_id && sourcePortalMap.get(event.source_id) === portalId) return true;
        return false;
      });

      const upcomingEvents = portalEvents.filter((e) => {
        const event = e as { start_date: string };
        return new Date(event.start_date) > now;
      });

      const eventsWithImages = portalEvents.filter((e) => {
        const event = e as { image_url: string | null };
        return event.image_url !== null && event.image_url.trim() !== "";
      });

      // Get unique venues for this portal
      const portalVenueIds = new Set(
        portalEvents
          .map((e) => (e as { venue_id: number | null }).venue_id)
          .filter((id): id is number => id !== null)
      );

      // Find most recent crawl from portal's sources
      let lastCrawl: string | null = null;
      for (const sourceId of Array.from(portalSources)) {
        const crawlTime = lastCrawlMap.get(sourceId);
        if (crawlTime && (!lastCrawl || crawlTime > lastCrawl)) {
          lastCrawl = crawlTime;
        }
      }

      // Count stale sources (not crawled in 3 days)
      let staleSources = 0;
      for (const sourceId of Array.from(portalSources)) {
        const crawlTime = lastCrawlMap.get(sourceId);
        if (!crawlTime || new Date(crawlTime) < staleThreshold) {
          staleSources++;
        }
      }

      return {
        portal_id: portalId,
        slug: portal.slug,
        name: portal.name,
        status: portal.status,
        total_events: portalEvents.length,
        upcoming_events: upcomingEvents.length,
        events_with_images: eventsWithImages.length,
        total_venues: portalVenueIds.size,
        total_sources: portalSources.size,
        last_crawl_at: lastCrawl,
        stale_sources: staleSources,
      };
    });

    // Sort: active first, then by upcoming events
    healthMetrics.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "active" ? -1 : 1;
      }
      return b.upcoming_events - a.upcoming_events;
    });

    // Summary stats
    const summary = {
      total: healthMetrics.length,
      active: healthMetrics.filter((p) => p.status === "active").length,
      with_upcoming_events: healthMetrics.filter((p) => p.upcoming_events > 0).length,
      stale: healthMetrics.filter((p) => p.stale_sources > 0 && p.total_sources > 0).length,
    };

    return NextResponse.json({
      portals: healthMetrics,
      summary,
    });
  } catch (error) {
    console.error("Error in GET /api/admin/portal-health:", error);
    return errorApiResponse("Internal server error", 500);
  }
}
