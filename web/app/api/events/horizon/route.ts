import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { apiResponse, errorApiResponse } from "@/lib/api-utils";
import { createClient } from "@/lib/supabase/server";
import { resolvePortalQueryContext, getVerticalFromRequest } from "@/lib/portal-query-context";
import { filterByPortalCity } from "@/lib/portal-scope";
import { getPlanningUrgency, ticketStatusFreshness } from "@/lib/types/planning-horizon";
import type { PlanningHorizonEvent } from "@/lib/types/planning-horizon";
import { logger } from "@/lib/logger";

const VALID_IMPORTANCE = new Set(["flagship", "major", "standard"]);

export async function GET(request: Request) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const { searchParams } = new URL(request.url);

    // months param: how far out to look (1–12, default 3)
    const monthsRaw = parseInt(searchParams.get("months") || "3", 10);
    const months = Math.min(Math.max(isNaN(monthsRaw) ? 3 : monthsRaw, 1), 12);

    // importance param: which tiers to include (default flagship + major)
    const importanceRaw = searchParams.get("importance")?.split(",").filter(Boolean) || ["flagship", "major"];
    const importance = importanceRaw.filter((i) => VALID_IMPORTANCE.has(i));
    if (importance.length === 0) importance.push("flagship", "major");

    // Resolve portal context
    const supabaseClient = await createClient();
    const portalContext = await resolvePortalQueryContext(
      supabaseClient,
      searchParams,
      getVerticalFromRequest(request),
    );
    const portalIdRaw = portalContext.portalId || searchParams.get("portal_id") || undefined;
    // Validate portal_id is a UUID to prevent PostgREST filter injection via .or() interpolation
    const portalId = portalIdRaw && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(portalIdRaw) ? portalIdRaw : undefined;
    const portalCity = portalContext.filters.city || undefined;

    // Date window: start 7+ days from now, end `months` months out
    const now = new Date();
    const startDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const endDate = new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Build query using per-request server client
    let query = supabaseClient
      .from("events")
      .select(
        `
        id, title, start_date, end_date, start_time, importance,
        category_id, image_url, source_url, featured_blurb,
        on_sale_date, presale_date, early_bird_deadline, announce_date,
        registration_opens, registration_closes, registration_url,
        ticket_status, ticket_status_checked_at, sellout_risk,
        ticket_url, price_min, price_max, is_free,
        festival_id,
        venue:venues(id, name, slug, neighborhood, city)
      `,
      )
      .in("importance", importance)
      .gte("start_date", startDate)
      .lte("start_date", endDate)
      .eq("is_active", true)
      .is("canonical_event_id", null)
      // Exclude event types that don't belong in a planning-ahead feed
      .neq("category_id", "tours")
      .not("category_id", "in", "(sports,recreation)")
      .neq("category_id", "unknown")
      .neq("is_class", true)
      // flagship events first (alphabetical: "flagship" < "major"), then chronological
      .order("importance", { ascending: true })
      .order("start_date", { ascending: true })
      .limit(40); // over-fetch to allow for city filtering

    // Scope to portal when provided — includes null portal_id as fallback,
    // with filterByPortalCity below catching cross-city leakage
    if (portalId) {
      query = query.or(`portal_id.eq.${portalId},portal_id.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("Planning horizon query failed", error, { component: "horizon" });
      return errorApiResponse("Failed to fetch horizon events", 500);
    }

    // Filter out cross-city leakage (events with portal_id=NULL from other cities)
    const cityFiltered = filterByPortalCity(
      (data || []) as Array<{ venue?: { city?: string | null } | null }>,
      portalCity,
      { allowMissingCity: false },
    );

    // Enrich with urgency and freshness computed server-side, map category_id → category
    const events: Array<PlanningHorizonEvent & { urgency: ReturnType<typeof getPlanningUrgency>; ticket_freshness: string | null }> =
      cityFiltered.slice(0, 20).map((e) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ev = e as any;
        return {
          ...ev,
          category: ev.category_id ?? null,
          featured_blurb: ev.featured_blurb ?? null,
          venue: ev.venue ?? null,
          urgency: getPlanningUrgency(ev),
          ticket_freshness: ticketStatusFreshness(ev.ticket_status_checked_at),
        };
      });

    return apiResponse(
      { events },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    logger.error("Planning horizon API error", error, { component: "horizon" });
    return errorApiResponse("Internal server error", 500);
  }
}
