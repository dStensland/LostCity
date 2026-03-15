import { createClient } from "@/lib/supabase/server";
import { getLocalDateString } from "@/lib/formats";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { apiResponse, escapeSQLPattern } from "@/lib/api-utils";
import { startOfDay, addDays, isSaturday, isSunday, nextSaturday, nextSunday, format } from "date-fns";
import { getPortalSourceAccess } from "@/lib/federation";
import { applyFeedGate } from "@/lib/feed-gate";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import { applyFederatedPortalScopeToQuery } from "@/lib/portal-scope";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";
import { logger } from "@/lib/logger";

function getDateRange(filter: string): { start: string; end: string } | null {
  const now = new Date();
  const today = startOfDay(now);

  switch (filter) {
    case "today":
      return {
        start: format(today, "yyyy-MM-dd"),
        end: format(today, "yyyy-MM-dd"),
      };
    case "weekend": {
      let satDate: Date;
      let sunDate: Date;
      if (isSaturday(now)) {
        satDate = today;
        sunDate = addDays(today, 1);
      } else if (isSunday(now)) {
        satDate = today;
        sunDate = today;
      } else {
        satDate = nextSaturday(today);
        sunDate = nextSunday(today);
      }
      return {
        start: format(satDate, "yyyy-MM-dd"),
        end: format(sunDate, "yyyy-MM-dd"),
      };
    }
    case "week":
      return {
        start: format(today, "yyyy-MM-dd"),
        end: format(addDays(today, 6), "yyyy-MM-dd"),
      };
    default:
      return null;
  }
}

export async function GET(request: Request) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const { searchParams } = new URL(request.url);
    const supabase = await createClient();
    const today = getLocalDateString();

    // Resolve portal context for federation scope (needed to build the cache key)
    const portalContext = await resolvePortalQueryContext(supabase, searchParams);
    const portalId = portalContext.portalId || searchParams.get("portal_id");

    const search = searchParams.get("search") ?? "";
    const categories = searchParams.get("categories") ?? "";
    const neighborhoods = searchParams.get("neighborhoods") ?? "";
    const price = searchParams.get("price") ?? "";
    const dateFilter = searchParams.get("date") ?? "";

    const cacheKey = `${portalId ?? "none"}|${search}|${categories}|${neighborhoods}|${price}|${dateFilter}`;

    type StandaloneTentpole = {
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

    type FestivalsPayload = {
      festivals: unknown[];
      standalone_tentpoles: StandaloneTentpole[];
    };

    const payload = await getOrSetSharedCacheJson<FestivalsPayload>(
      "api:festivals-upcoming",
      cacheKey,
      5 * 60 * 1000,
      async () => {
        let query = supabase
          .from("festivals")
          .select("id, name, slug, website, location, neighborhood, categories, free, announced_start, announced_end, ticket_url, description, image_url, typical_month, typical_duration_days, festival_type, portal_id")
          .not("announced_start", "is", null)
          .or(`announced_end.gte.${today},announced_end.is.null`)
          .not("festival_type", "in", "(conference,trade_show,professional_development,convention)")
          .order("announced_start", { ascending: true })
          .limit(50);

        // Portal filter - only show festivals for the requested portal
        if (portalId) {
          query = query.eq("portal_id", portalId);
        }

        // Search filter
        if (search) {
          const escaped = escapeSQLPattern(search);
          query = query.ilike("name", `%${escaped}%`);
        }

        // Categories filter (overlaps with festivals.categories array)
        const categoryList = categories.split(",").filter(Boolean);
        if (categoryList.length > 0) {
          query = query.overlaps("categories", categoryList);
        }

        // Neighborhoods filter
        const neighborhoodList = neighborhoods.split(",").filter(Boolean);
        if (neighborhoodList.length > 0) {
          query = query.in("neighborhood", neighborhoodList);
        }

        // Free filter
        if (price === "free") {
          query = query.eq("free", true);
        }

        // Date filter - festival overlaps with the requested date range
        if (dateFilter) {
          const range = getDateRange(dateFilter);
          if (range) {
            // Festival overlaps with range if: announced_start <= range.end AND (announced_end >= range.start OR announced_end IS NULL)
            query = query
              .lte("announced_start", range.end)
              .or(`announced_end.gte.${range.start},announced_end.is.null`);
          }
        }

        // Run festivals query and portal source access lookup in parallel
        const [festivalsResult, sourceAccess] = await Promise.all([
          query,
          portalId ? getPortalSourceAccess(portalId) : Promise.resolve(null),
        ]);

        const { data, error } = festivalsResult;

        if (error) {
          logger.error("Festivals upcoming API error:", { error: error.message });
          throw error;
        }

        const allowedSourceIds: number[] | null = sourceAccess?.sourceIds ?? null;
        const categoryConstraints: Map<number, string[] | null> | null =
          sourceAccess?.categoryConstraints ?? null;

        let standaloneTentpoles: StandaloneTentpole[] = [];

        if (!portalId || (allowedSourceIds && allowedSourceIds.length > 0)) {
          let tentpoleQuery = supabase
            .from("events")
            .select(`
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
              venue:venues(id, name, slug, neighborhood)
            `)
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
            logger.error("Festivals upcoming tentpoles API error:", { error: tentpoleError.message });
          } else {
            const rawTentpoles = (tentpoleData || []) as StandaloneTentpole[];
            standaloneTentpoles = rawTentpoles.filter((event) => {
              if (!categoryConstraints || event.source_id == null) return true;
              if (!categoryConstraints.has(event.source_id)) return true;
              const allowed = categoryConstraints.get(event.source_id);
              if (allowed == null) return true;
              return !!event.category && allowed.includes(event.category);
            });
          }
        }

        // Server-side dedup: remove tentpoles whose title matches a festival name
        const festivals = data || [];
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
        const festivalNorms = festivals.map((f: { name: string }) => normalize(f.name));
        const dedupedTentpoles = standaloneTentpoles.filter((t) => {
          const normTitle = normalize(t.title);
          return !festivalNorms.some((fn: string) => fn.includes(normTitle) || normTitle.includes(fn));
        });

        return { festivals, standalone_tentpoles: dedupedTentpoles };
      },
      { maxEntries: 100 },
    );

    return apiResponse(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    logger.error("Festivals upcoming API error:", error);
    return apiResponse(
      { error: "Failed to fetch festivals", festivals: [] },
      { status: 500 }
    );
  }
}
