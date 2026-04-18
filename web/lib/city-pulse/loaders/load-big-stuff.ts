/**
 * Server loader for the "Big Stuff" feed section (month ribbon).
 *
 * Added 2026-04-18. Sibling to load-festivals.ts, which continues to power the
 * see-all page's filter UI via /api/festivals/upcoming. This loader is Big
 * Stuff-specific: forward-looking query, announced_2026 gate, month-grouped
 * payload for the ribbon component.
 *
 * Display-only fields (currentMonthLabel, etc.) are NOT computed here — the
 * component derives them at render time so cached payloads don't go stale
 * across midnight.
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
import type { FeedSectionContext } from "../feed-section-contract";

const HORIZON_MONTHS = 6;
const MAX_ITEMS_PER_MONTH = 3;

export type BigStuffKind = "festival" | "tentpole";

export interface BigStuffItem {
  id: string;
  kind: BigStuffKind;
  title: string;
  startDate: string;
  endDate: string | null;
  location: string | null;
  href: string;
}

export interface BigStuffMonthBucket {
  /** YYYY-MM */
  monthKey: string;
  /** Absolute month index, e.g. 2026-04 → (2026*12)+4; used for stable sort */
  monthIndex: number;
  /** Truncated list, capped at MAX_ITEMS_PER_MONTH */
  items: BigStuffItem[];
  /** How many additional items existed beyond the cap */
  overflowCount: number;
  /**
   * True when this monthKey matches the `today` arg passed at group time.
   * Caller passes today at render, so this flag reflects render-time clock,
   * not cache-write time.
   */
  isCurrentMonth: boolean;
}

export interface BigStuffFeedData {
  /** Raw items, unshuffled. Grouping happens in the component via groupItemsByMonth. */
  items: BigStuffItem[];
}

/** Festivals row shape — matches the SELECT in fetchBigStuffForPortal. */
type BigStuffFestivalRow = {
  id: string;
  name: string;
  slug: string | null;
  neighborhood: string | null;
  location: string | null;
  announced_start: string;
  announced_end: string | null;
};

/** Tentpole event row shape — matches the SELECT in fetchBigStuffForPortal. */
type BigStuffTentpoleRow = {
  id: number;
  title: string;
  start_date: string;
  end_date: string | null;
  category: string | null;
  source_id: number | null;
  venue: { id: number; name: string; slug: string; neighborhood: string | null } | null;
};

/** Feed-contract loader. Errors are swallowed so the feed stays up. */
export async function loadBigStuffForFeed(
  ctx: FeedSectionContext,
): Promise<BigStuffFeedData | null> {
  try {
    const items = await fetchBigStuffForPortal(ctx.portalId, ctx.portalSlug);
    return { items };
  } catch (err) {
    logger.error("load-big-stuff failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ── Grouping (tested, pure) ──────────────────────────────────────────────

export function groupItemsByMonth(
  items: BigStuffItem[],
  today: string,
  horizonMonths: number,
): BigStuffMonthBucket[] {
  const [yStr, mStr] = today.split("-");
  const baseYear = parseInt(yStr, 10);
  const baseMonth = parseInt(mStr, 10); // 1..12
  const baseIndex = baseYear * 12 + baseMonth;
  const currentMonthKey = `${yStr}-${mStr.padStart(2, "0")}`;

  const buckets = new Map<string, BigStuffMonthBucket>();
  for (let offset = 0; offset < horizonMonths; offset++) {
    const idx = baseIndex + offset;
    const year = Math.floor((idx - 1) / 12);
    const month = ((idx - 1) % 12) + 1;
    const monthKey = `${year}-${month.toString().padStart(2, "0")}`;
    buckets.set(monthKey, {
      monthKey,
      monthIndex: idx,
      items: [],
      overflowCount: 0,
      isCurrentMonth: monthKey === currentMonthKey,
    });
  }

  const sorted = [...items]
    .filter((it) => it.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  for (const item of sorted) {
    const monthKey = item.startDate.slice(0, 7);
    const bucket = buckets.get(monthKey);
    if (!bucket) continue; // beyond horizon
    if (bucket.items.length < MAX_ITEMS_PER_MONTH) {
      bucket.items.push(item);
    } else {
      bucket.overflowCount += 1;
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.monthIndex - b.monthIndex);
}

// ── Database fetch ────────────────────────────────────────────────────────

async function fetchBigStuffForPortal(
  portalId: string | null | undefined,
  portalSlug: string,
): Promise<BigStuffItem[]> {
  const cacheKey = `${portalId ?? "none"}|${getLocalDateString()}|big-stuff-v1`;

  return getOrSetSharedCacheJson<BigStuffItem[]>(
    "api:big-stuff",
    cacheKey,
    5 * 60 * 1000,
    async () => {
      const supabase = await createClient();
      const today = getLocalDateString();
      const horizonDate = addMonthsISO(today, HORIZON_MONTHS);

      let festivalsQuery = supabase
        .from("festivals")
        .select(
          "id, name, slug, neighborhood, location, announced_start, announced_end, festival_type, portal_id, announced_2026",
        )
        .eq("announced_2026", true)
        .gt("announced_start", today)
        .lte("announced_start", horizonDate)
        .not(
          "festival_type",
          "in",
          "(conference,trade_show,professional_development,convention)",
        )
        .order("announced_start", { ascending: true })
        .limit(60);

      if (portalId) {
        festivalsQuery = festivalsQuery.eq("portal_id", portalId);
      }

      const [festivalsResult, sourceAccess] = await Promise.all([
        festivalsQuery,
        portalId ? getPortalSourceAccess(portalId) : Promise.resolve(null),
      ]);

      const { data: festivalsData, error: festivalsError } = festivalsResult;
      if (festivalsError) throw festivalsError;

      const festivals: BigStuffItem[] = ((festivalsData ?? []) as BigStuffFestivalRow[]).map((f) => ({
        id: `festival:${f.id}`,
        kind: "festival",
        title: f.name,
        startDate: f.announced_start,
        endDate: f.announced_end,
        location: f.neighborhood || f.location,
        href: f.slug ? `/${portalSlug}/festivals/${f.slug}` : `/${portalSlug}/festivals`,
      }));

      const allowedSourceIds: number[] | null = sourceAccess?.sourceIds ?? null;
      let tentpoles: BigStuffItem[] = [];

      if (!portalId || (allowedSourceIds && allowedSourceIds.length > 0)) {
        let tentpoleQuery = supabase
          .from("events")
          .select(
            `id, title, start_date, end_date, category:category_id, source_id, venue:places(id, name, slug, neighborhood)`,
          )
          .eq("is_tentpole", true)
          .eq("is_active", true)
          .is("festival_id", null)
          .gt("start_date", today)
          .lte("start_date", horizonDate)
          .is("canonical_event_id", null)
          .order("start_date", { ascending: true })
          .limit(60);

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
          logger.error("load-big-stuff tentpoles error", {
            error: tentpoleError.message,
          });
        } else {
          const raw = (tentpoleData ?? []) as BigStuffTentpoleRow[];
          tentpoles = raw
            .filter((event) =>
              isEventCategoryAllowedForSourceAccess(
                sourceAccess,
                event.source_id,
                event.category,
              ),
            )
            .map((e) => ({
              id: `event:${e.id}`,
              kind: "tentpole" as BigStuffKind,
              title: e.title,
              startDate: e.start_date,
              endDate: e.end_date,
              location: e.venue?.name || e.venue?.neighborhood || null,
              href: `/${portalSlug}?event=${e.id}`,
            }));
        }
      }

      // Dedup tentpoles whose normalized title matches a festival name.
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const festivalNorms = festivals.map((f) => normalize(f.title));
      const dedupedTentpoles = tentpoles.filter((t) => {
        const norm = normalize(t.title);
        return !festivalNorms.some((fn) => fn.includes(norm) || norm.includes(fn));
      });

      return [...festivals, ...dedupedTentpoles];
    },
    { maxEntries: 100 },
  );
}

function addMonthsISO(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().slice(0, 10);
}
