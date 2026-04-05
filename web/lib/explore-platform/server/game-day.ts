import "server-only";

import { createPortalScopedClient } from "@/lib/supabase/server";
import { getPortalBySlug } from "@/lib/portal";
import {
  applyManifestFederatedScopeToQuery,
  excludeSensitiveEvents,
} from "@/lib/portal-scope";
import { buildPortalManifest } from "@/lib/portal-manifest";
import { getPortalSourceAccess } from "@/lib/federation";
import { applyFeedGate } from "@/lib/feed-gate";
import { getLocalDateString } from "@/lib/formats";
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
import type { ExploreLaneServerLoaderArgs } from "@/lib/explore-platform/types";
import type { GameDayLaneInitialData } from "@/lib/explore-platform/lane-data";

const SOURCE_ID_CACHE_NAMESPACE = "feed-config";
const SOURCE_ID_CACHE_KEY = "team-source-id-map";
const SOURCE_ID_CACHE_TTL_MS = 60 * 60 * 1000;
const GAME_DAY_CACHE_NAMESPACE = "api:game-day";
const GAME_DAY_CACHE_TTL_MS = 5 * 60 * 1000;
const GAME_DAY_WINDOW_DAYS = 14;

const GATED_VERTICALS = new Set(["community", "hotel"]);

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

async function getTeamSourceIdMap(
  portalClient: Awaited<ReturnType<typeof createPortalScopedClient>>,
): Promise<Record<string, number>> {
  return getOrSetSharedCacheJson<Record<string, number>>(
    SOURCE_ID_CACHE_NAMESPACE,
    SOURCE_ID_CACHE_KEY,
    SOURCE_ID_CACHE_TTL_MS,
    async () => {
      const { data } = await portalClient
        .from("sources")
        .select("id, slug")
        .in("slug", ALL_SOURCE_SLUGS);

      const map: Record<string, number> = {};
      for (const row of data ?? []) {
        const typed = row as { id: number; slug: string };
        map[typed.slug] = typed.id;
      }
      return map;
    },
  );
}

export async function getGameDayPayload(
  portalSlug: string,
): Promise<GameDayResponse> {
  const today = getLocalDateString(new Date());
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + GAME_DAY_WINDOW_DAYS);
  const windowEndStr = windowEnd.toISOString().split("T")[0];
  const cacheKey = `${portalSlug}|${today}|${GAME_DAY_WINDOW_DAYS}d`;

  return getOrSetSharedCacheJson<GameDayResponse>(
    GAME_DAY_CACHE_NAMESPACE,
    cacheKey,
    GAME_DAY_CACHE_TTL_MS,
    async () => {
      const portal = await getPortalBySlug(portalSlug);
      if (!portal) {
        return { teams: [] };
      }

      const vertical = normalizePortalVertical(portal.settings?.vertical);
      if (GATED_VERTICALS.has(vertical)) {
        return { teams: [] };
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

      const sourceIdMap = await getTeamSourceIdMap(portalClient);
      const sourceIdToTeam = new Map<number, (typeof TEAMS)[number]>();

      for (const team of TEAMS) {
        for (const sourceSlug of team.sourceSlugs) {
          const sourceId = sourceIdMap[sourceSlug];
          if (sourceId !== undefined && !sourceIdToTeam.has(sourceId)) {
            sourceIdToTeam.set(sourceId, team);
          }
        }
      }

      let query = portalClient
        .from("events")
        .select(
          `
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
          `,
        )
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

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      const teamEvents = new Map<string, GameEvent[]>();
      for (const event of (data as RawEvent[] | null) ?? []) {
        let matchedTeam: (typeof TEAMS)[number] | undefined;

        if (event.source_id !== null) {
          matchedTeam = sourceIdToTeam.get(event.source_id);
        }

        if (!matchedTeam && event.tags?.length) {
          const tagSet = new Set(event.tags);
          const hasSportsContext = event.tags.some((tag) =>
            SPORTS_CONTEXT_TAGS.has(tag),
          );

          if (hasSportsContext) {
            for (const team of TEAMS) {
              if (team.tags.some((tag) => tagSet.has(tag))) {
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

      const teams: TeamSchedule[] = [];
      for (const team of TEAMS) {
        const eventsForTeam = teamEvents.get(team.slug);
        if (!eventsForTeam?.length) continue;

        teams.push({
          slug: team.slug,
          name: team.name,
          shortName: team.shortName,
          sport: team.sport,
          league: team.league,
          accentColor: team.accentColor,
          logoUrl: team.logoUrl,
          heroUrl: team.heroUrl,
          nextGame: eventsForTeam[0] ?? null,
          upcoming: eventsForTeam.slice(1, 4),
          totalUpcoming: Math.max(0, eventsForTeam.length - 1),
        });
      }

      return { teams };
    },
  );
}

export async function getExploreGameDayInitialData({
  portalSlug,
}: ExploreLaneServerLoaderArgs): Promise<GameDayLaneInitialData | null> {
  const today = getLocalDateString(new Date());
  const payload = await getGameDayPayload(portalSlug);

  return {
    teams: payload.teams,
    requestKey: `${portalSlug}|${today}|${GAME_DAY_WINDOW_DAYS}d`,
  };
}
