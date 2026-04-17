/**
 * Server loader for the Festivals ("Big Stuff") feed section.
 *
 * The `/api/festivals/upcoming` route still owns filter/search params, caching,
 * and rate-limiting for public API consumers. The feed only ever calls it with
 * a single portal_id (no filters), so this loader extracts the no-filter
 * fetch path and shares the same cache namespace + key shape — a warm route
 * cache hit is also a warm feed hit.
 */
import { createClient } from "@/lib/supabase/server";
import { getLocalDateString } from "@/lib/formats";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";
import { applyFeedGate } from "@/lib/feed-gate";
import { applyFederatedPortalScopeToQuery } from "@/lib/portal-scope";
import {
  getPortalSourceAccess,
  isEventCategoryAllowedForSourceAccess,
} from "@/lib/federation";
import { logger } from "@/lib/logger";
import type { Festival } from "@/lib/festivals";
import type { FeedSectionContext } from "../feed-section-contract";

export type StandaloneTentpole = {
  id: number;
  title: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  category: string | null;
  image_url: string | null;
  description: string | null;
  source_id: number | null;
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
  } | null;
};

export interface FestivalsFeedData {
  festivals: Festival[];
  standalone_tentpoles: StandaloneTentpole[];
}

/**
 * FeedSection-compatible loader. Swallows errors and returns null so a
 * festivals outage never takes down the full feed.
 */
export async function loadFestivalsForFeed(
  ctx: FeedSectionContext,
): Promise<FestivalsFeedData | null> {
  try {
    return await fetchUpcomingFestivalsForPortal(ctx.portalId);
  } catch (err) {
    logger.error("load-festivals failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function fetchUpcomingFestivalsForPortal(
  portalId: string | null | undefined,
): Promise<FestivalsFeedData> {
  // Same cache namespace + key shape as the public route's no-filter path,
  // so route + feed share cache entries.
  const cacheKey = `${portalId ?? "none"}|||||`;

  return getOrSetSharedCacheJson<FestivalsFeedData>(
    "api:festivals-upcoming",
    cacheKey,
    5 * 60 * 1000,
    async () => {
      const supabase = await createClient();
      const today = getLocalDateString();

      let festivalsQuery = supabase
        .from("festivals")
        .select(
          "id, name, slug, website, location, neighborhood, categories, free, announced_start, announced_end, ticket_url, description, image_url, typical_month, typical_duration_days, festival_type, portal_id",
        )
        .not("announced_start", "is", null)
        .or(`announced_end.gte.${today},announced_end.is.null`)
        .not(
          "festival_type",
          "in",
          "(conference,trade_show,professional_development,convention)",
        )
        .order("announced_start", { ascending: true })
        .limit(50);

      if (portalId) {
        festivalsQuery = festivalsQuery.eq("portal_id", portalId);
      }

      const [festivalsResult, sourceAccess] = await Promise.all([
        festivalsQuery,
        portalId ? getPortalSourceAccess(portalId) : Promise.resolve(null),
      ]);

      const { data: festivalsData, error: festivalsError } = festivalsResult;
      if (festivalsError) throw festivalsError;

      const allowedSourceIds: number[] | null = sourceAccess?.sourceIds ?? null;
      let standaloneTentpoles: StandaloneTentpole[] = [];

      if (!portalId || (allowedSourceIds && allowedSourceIds.length > 0)) {
        let tentpoleQuery = supabase
          .from("events")
          .select(
            `
            id,
            title,
            start_date,
            end_date,
            start_time,
            end_time,
            category:category_id,
            image_url,
            description,
            source_id,
            venue:places(id, name, slug, neighborhood)
          `,
          )
          .eq("is_tentpole", true)
          .eq("is_active", true)
          .is("festival_id", null)
          .or(`start_date.gte.${today},end_date.gte.${today}`)
          .is("canonical_event_id", null)
          .order("start_date", { ascending: true })
          .order("start_time", { ascending: true })
          .limit(30);

        if (allowedSourceIds && allowedSourceIds.length > 0) {
          tentpoleQuery = tentpoleQuery.in("source_id", allowedSourceIds);
        }
        tentpoleQuery = applyFeedGate(tentpoleQuery);
        if (portalId) {
          tentpoleQuery = applyFederatedPortalScopeToQuery(tentpoleQuery, {
            portalId,
            sourceIds: allowedSourceIds || [],
          });
        }

        const { data: tentpoleData, error: tentpoleError } = await tentpoleQuery;
        if (tentpoleError) {
          logger.error("load-festivals tentpoles error", {
            error: tentpoleError.message,
          });
        } else {
          const raw = (tentpoleData ?? []) as StandaloneTentpole[];
          standaloneTentpoles = raw.filter((event) =>
            isEventCategoryAllowedForSourceAccess(
              sourceAccess,
              event.source_id,
              event.category,
            ),
          );
        }
      }

      const festivals = (festivalsData ?? []) as Festival[];
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const festivalNorms = festivals.map((f) => normalize(f.name));
      const dedupedTentpoles = standaloneTentpoles.filter((t) => {
        const normTitle = normalize(t.title);
        return !festivalNorms.some(
          (fn) => fn.includes(normTitle) || normTitle.includes(fn),
        );
      });

      return { festivals, standalone_tentpoles: dedupedTentpoles };
    },
    { maxEntries: 100 },
  );
}
