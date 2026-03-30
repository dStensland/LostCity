import { NextRequest, NextResponse } from "next/server";
import { createPortalScopedClient } from "@/lib/supabase/server";
import { getPortalBySlug } from "@/lib/portal";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { getLocalDateString } from "@/lib/formats";
import { logger } from "@/lib/logger";
import { isValidUUID } from "@/lib/api-utils";
import {
  applyManifestFederatedScopeToQuery,
  excludeSensitiveEvents,
} from "@/lib/portal-scope";
import { buildPortalManifest } from "@/lib/portal-manifest";
import { getPortalSourceAccess } from "@/lib/federation";
import { applyFeedGate } from "@/lib/feed-gate";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";
import { normalizePortalVertical } from "@/lib/portal-taxonomy";
import {
  TEAMS,
  ALL_SOURCE_SLUGS,
  SPORTS_CONTEXT_TAGS,
  type GameEvent,
  type GameDayResponse,
  type TeamSchedule,
} from "@/lib/teams-config";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

/** Verticals that don't host a Game Day section */
const GATED_VERTICALS = new Set(["community", "hotel"]);

/**
 * Resolve source slugs to integer IDs, cached for 1 hour.
 * Uses Record<string, number> — Maps don't survive JSON serialization.
 */
async function getTeamSourceIdMap(
  portalClient: Awaited<ReturnType<typeof createPortalScopedClient>>,
): Promise<Record<string, number>> {
  return getOrSetSharedCacheJson<Record<string, number>>(
    "feed-config",
    "team-source-id-map",
    60 * 60 * 1000, // 1 hour TTL
    async () => {
      const { data } = await portalClient
        .from("sources")
        .select("id, slug")
        .in("slug", ALL_SOURCE_SLUGS);
      const map: Record<string, number> = {};
      for (const row of data ?? []) {
        map[(row as { id: number; slug: string }).slug] = (
          row as { id: number; slug: string }
        ).id;
      }
      return map;
    },
  );
}

// GET /api/portals/[slug]/game-day
export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await context.params;

  const today = getLocalDateString(new Date());
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + 14);
  const windowEndStr = windowEnd.toISOString().split("T")[0];

  try {
    const portal = await getPortalBySlug(slug);
    if (!portal || !isValidUUID(portal.id)) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    // Gate: community and hotel portals don't host a Game Day section
    const vertical = normalizePortalVertical(portal.settings?.vertical);
    if (GATED_VERTICALS.has(vertical)) {
      return NextResponse.json({ teams: [] } satisfies GameDayResponse, {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      });
    }

    const sourceAccess = await getPortalSourceAccess(portal.id);
    const portalClient = await createPortalScopedClient(portal.id);
    const manifest = buildPortalManifest({
      portalId: portal.id,
      slug: portal.slug,
      portalType: portal.portal_type,
      parentPortalId: portal.parent_portal_id,
      settings: portal.settings,
      filters: portal.filters as { city?: string; cities?: string[] } | null,
      sourceIds: sourceAccess.sourceIds,
    });

    // Resolve source slugs → IDs (cached 1h)
    const sourceIdMap = await getTeamSourceIdMap(portalClient);

    // Build a lookup: source_id → TeamConfig
    const sourceIdToTeam = new Map<number, (typeof TEAMS)[number]>();
    for (const team of TEAMS) {
      for (const srcSlug of team.sourceSlugs) {
        const id = sourceIdMap[srcSlug];
        if (id !== undefined) {
          // Only register if not already claimed by a higher-priority team
          if (!sourceIdToTeam.has(id)) {
            sourceIdToTeam.set(id, team);
          }
        }
      }
    }

    // Fetch sports events in the next 14 days
    let query = portalClient
      .from("events")
      .select(`
        id,
        title,
        start_date,
        start_time,
        source_id,
        tags,
        ticket_url,
        image_url,
        is_free,
        venue:places!inner(name, slug)
      `)
      .eq("category_id", "sports")
      .gte("start_date", today)
      .lte("start_date", windowEndStr)
      .eq("is_active", true)
      .is("canonical_event_id", null)
      .or("is_class.eq.false,is_class.is.null")
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: false });

    query = applyFeedGate(query);
    query = applyManifestFederatedScopeToQuery(query, manifest, {
      publicOnlyWhenNoPortal: true,
      sourceIds: sourceAccess.sourceIds,
      sourceColumn: "source_id",
    });
    query = excludeSensitiveEvents(query);

    type RawEvent = {
      id: number;
      title: string;
      start_date: string;
      start_time: string | null;
      source_id: number | null;
      tags: string[] | null;
      ticket_url: string | null;
      image_url: string | null;
      is_free: boolean;
      venue: { name: string; slug: string } | null;
    };

    const { data: rawEvents, error: queryError } = await query;
    if (queryError) {
      logger.error("Error fetching game-day events:", queryError);
      return NextResponse.json(
        { error: "Failed to fetch game day events" },
        { status: 500 },
      );
    }

    const events = (rawEvents ?? []) as RawEvent[];

    // Match each event to a team: source_id first, tag fallback second
    const teamEvents = new Map<string, GameEvent[]>(); // teamSlug → events

    for (const event of events) {
      let matchedTeam: (typeof TEAMS)[number] | undefined;

      // 1. Authoritative: source_id match
      if (event.source_id !== null) {
        matchedTeam = sourceIdToTeam.get(event.source_id);
      }

      // 2. Tag fallback: requires a team tag AND a sports-context tag
      if (!matchedTeam && event.tags && event.tags.length > 0) {
        const eventTagSet = new Set(event.tags);
        const hasSportsContext = event.tags.some((t) =>
          SPORTS_CONTEXT_TAGS.has(t),
        );

        if (hasSportsContext) {
          // Find first matching team by priority order (TEAMS is already priority-sorted)
          for (const team of TEAMS) {
            if (team.tags.some((t) => eventTagSet.has(t))) {
              matchedTeam = team;
              break;
            }
          }
        }
      }

      if (!matchedTeam) continue;

      const gameEvent: GameEvent = {
        id: event.id,
        title: event.title,
        startDate: event.start_date,
        startTime: event.start_time,
        venueName: event.venue?.name ?? "",
        venueSlug: event.venue?.slug ?? "",
        isFree: event.is_free,
        ticketUrl: event.ticket_url,
        imageUrl: event.image_url,
      };

      const existing = teamEvents.get(matchedTeam.slug) ?? [];
      existing.push(gameEvent);
      teamEvents.set(matchedTeam.slug, existing);
    }

    // Build response: only include teams with events
    const teams: TeamSchedule[] = [];
    for (const team of TEAMS) {
      const eventsForTeam = teamEvents.get(team.slug);
      if (!eventsForTeam || eventsForTeam.length === 0) continue;

      // Events are already ordered chronologically from the query
      const nextGame = eventsForTeam[0] ?? null;
      const upcoming = eventsForTeam.slice(1, 4); // next 3 after nextGame

      teams.push({
        slug: team.slug,
        name: team.name,
        shortName: team.shortName,
        sport: team.sport,
        league: team.league,
        accentColor: team.accentColor,
        logoUrl: team.logoUrl,
        nextGame,
        upcoming,
        totalUpcoming: Math.max(0, eventsForTeam.length - 1),
      });
    }

    return NextResponse.json(
      { teams } satisfies GameDayResponse,
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (err) {
    logger.error("Error in game-day GET:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
