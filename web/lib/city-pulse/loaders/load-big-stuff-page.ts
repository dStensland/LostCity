/**
 * Server loader for the /[portal]/festivals page ("Big Stuff" see-all).
 *
 * Mirrors load-big-stuff.ts but:
 *   - Does NOT exclude conference/convention festival_types (filter chips handle it).
 *   - Includes in-progress events (start_date <= today <= end_date) for the current month.
 *   - Enriches each item with type, isLiveNow, description, imageUrl, tier.
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
import { extractTeaser } from "@/lib/teaser";
import { getBigStuffType } from "@/lib/big-stuff/type-derivation";
import type {
  BigStuffPageData,
  BigStuffPageItem,
  BigStuffType,
} from "@/lib/big-stuff/types";
import type { FeedSectionContext } from "../feed-section-contract";

const HORIZON_MONTHS = 6;

export interface LoaderRow {
  kind: "festival" | "tentpole";
  id: string | number;
  title: string;
  slug: string | null;
  startDate: string;
  endDate: string | null;
  festivalType: string | null;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
  neighborhood: string | null;
  location: string | null;
}

export async function loadBigStuffForPage(
  ctx: FeedSectionContext,
): Promise<BigStuffPageData | null> {
  try {
    const items = await fetchBigStuffForPage(ctx.portalId, ctx.portalSlug);
    return { items };
  } catch (err) {
    logger.error("load-big-stuff-page failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export function enrichItem(
  row: LoaderRow,
  today: string,
  portalSlug: string,
): BigStuffPageItem {
  const isLiveNow =
    row.startDate <= today &&
    (row.endDate ?? row.startDate) >= today;

  const type: BigStuffType = getBigStuffType({
    kind: row.kind,
    title: row.title,
    festivalType: row.festivalType,
    category: row.category,
  });

  const tier: "hero" | "featured" | "standard" = row.kind === "festival" && row.imageUrl
    ? "hero"
    : row.imageUrl
    ? "featured"
    : "standard";

  const href =
    row.kind === "festival"
      ? row.slug
        ? `/${portalSlug}/festivals/${row.slug}`
        : `/${portalSlug}/festivals`
      : `/${portalSlug}?event=${row.id}`;

  const id = row.kind === "festival" ? `festival:${row.id}` : `event:${row.id}`;

  return {
    id,
    kind: row.kind,
    title: row.title,
    startDate: row.startDate,
    endDate: row.endDate,
    location: row.neighborhood ?? row.location,
    href,
    type,
    isLiveNow,
    description: extractTeaser(row.description),
    imageUrl: row.imageUrl,
    tier,
  };
}

type FestivalQueryRow = {
  id: string;
  name: string;
  slug: string | null;
  neighborhood: string | null;
  location: string | null;
  announced_start: string;
  announced_end: string | null;
  festival_type: string | null;
  description: string | null;
  image_url: string | null;
};

type TentpoleQueryRow = {
  id: number;
  title: string;
  start_date: string;
  end_date: string | null;
  category: string | null;
  source_id: number | null;
  description: string | null;
  image_url: string | null;
  venue: { id: number; name: string; slug: string; neighborhood: string | null } | null;
};

async function fetchBigStuffForPage(
  portalId: string | null | undefined,
  portalSlug: string,
): Promise<BigStuffPageItem[]> {
  const cacheKey = `${portalId ?? "none"}|${getLocalDateString()}|big-stuff-page-v1`;

  return getOrSetSharedCacheJson<BigStuffPageItem[]>(
    "api:big-stuff-page",
    cacheKey,
    5 * 60 * 1000,
    async () => {
      const supabase = await createClient();
      const today = getLocalDateString();
      const horizonDate = addMonthsISO(today, HORIZON_MONTHS);

      let festivalsQuery = supabase
        .from("festivals")
        .select(
          "id, name, slug, neighborhood, location, announced_start, announced_end, festival_type, description, image_url, portal_id, announced_2026",
        )
        .eq("announced_2026", true)
        .lte("announced_start", horizonDate)
        .or(
          `announced_start.gt.${today},and(announced_start.lte.${today},announced_end.gte.${today})`,
        )
        .order("announced_start", { ascending: true })
        .limit(100);

      if (portalId) festivalsQuery = festivalsQuery.eq("portal_id", portalId);

      const [festivalsResult, sourceAccess] = await Promise.all([
        festivalsQuery,
        portalId ? getPortalSourceAccess(portalId) : Promise.resolve(null),
      ]);
      if (festivalsResult.error) throw festivalsResult.error;

      const festivalRows = (festivalsResult.data ?? []) as FestivalQueryRow[];
      const festivalItems = festivalRows.map((f) =>
        enrichItem(
          {
            kind: "festival",
            id: f.id,
            title: f.name,
            slug: f.slug,
            startDate: f.announced_start,
            endDate: f.announced_end,
            festivalType: f.festival_type,
            category: null,
            description: f.description,
            imageUrl: f.image_url,
            neighborhood: f.neighborhood,
            location: f.location,
          },
          today,
          portalSlug,
        ),
      );

      const allowedSourceIds: number[] | null = sourceAccess?.sourceIds ?? null;
      let tentpoleItems: BigStuffPageItem[] = [];

      if (!portalId || (allowedSourceIds && allowedSourceIds.length > 0)) {
        let tentpoleQuery = supabase
          .from("events")
          .select(
            `id, title, start_date, end_date, category:category_id, source_id, description, image_url, venue:places(id, name, slug, neighborhood)`,
          )
          .eq("is_tentpole", true)
          .eq("is_active", true)
          .is("festival_id", null)
          .is("canonical_event_id", null)
          .lte("start_date", horizonDate)
          .or(
            `start_date.gt.${today},and(start_date.lte.${today},end_date.gte.${today})`,
          )
          .order("start_date", { ascending: true })
          .limit(100);

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
          logger.error("load-big-stuff-page tentpoles error", {
            error: tentpoleError.message,
          });
        } else {
          const raw = (tentpoleData ?? []) as TentpoleQueryRow[];
          tentpoleItems = raw
            .filter((e) =>
              isEventCategoryAllowedForSourceAccess(
                sourceAccess,
                e.source_id,
                e.category,
              ),
            )
            .map((e) =>
              enrichItem(
                {
                  kind: "tentpole",
                  id: e.id,
                  title: e.title,
                  slug: null,
                  startDate: e.start_date,
                  endDate: e.end_date,
                  festivalType: null,
                  category: e.category,
                  description: e.description,
                  imageUrl: e.image_url,
                  neighborhood: e.venue?.neighborhood ?? null,
                  location: e.venue?.name ?? null,
                },
                today,
                portalSlug,
              ),
            );
        }
      }

      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const festivalNorms = festivalItems.map((f) => normalize(f.title));
      const dedupedTentpoles = tentpoleItems.filter((t) => {
        const n = normalize(t.title);
        return !festivalNorms.some((fn) => fn.includes(n) || n.includes(fn));
      });

      return [...festivalItems, ...dedupedTentpoles];
    },
    { maxEntries: 100 },
  );
}

function addMonthsISO(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().slice(0, 10);
}
