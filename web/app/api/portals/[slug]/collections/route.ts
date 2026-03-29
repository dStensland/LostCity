/**
 * GET /api/portals/[slug]/collections
 *
 * Returns data-driven themed bundles for the feed browse grid.
 * Each collection is a bounded parameterized query — no hardcoded data.
 *
 * Collections (up to 5, zero-count ones excluded):
 *   1. Free This Weekend — is_free=true on upcoming Saturday/Sunday
 *   2. Date Night [Neighborhood] — tonight's busiest neighborhood
 *   3. New in Atlanta — places created in last 30 days
 *   4. Family Sunday — family events on next Sunday (Sat/Sun only)
 *   5. Closing Soon — exhibitions closing within 14 days
 *
 * Cache: 15-minute ISR + s-maxage=900 header
 * Rate limit: RATE_LIMITS.read
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { normalizePortalSlug, resolvePortalSlugAlias } from "@/lib/portal-aliases";
import { getLocalDateString } from "@/lib/formats";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Collection {
  title: string;
  count: number;
  slug: string;
  categories: string[];
  href: string;
}

export interface CollectionsResponse {
  collections: Collection[];
}

// ---------------------------------------------------------------------------
// Date helpers (ET-aware)
// ---------------------------------------------------------------------------

/**
 * Returns the day-of-week (0=Sun…6=Sat) in America/New_York.
 */
function getETDayOfWeek(now: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  });
  const DAYS: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const part = fmt.formatToParts(now).find((p) => p.type === "weekday")?.value ?? "Sun";
  return DAYS[part] ?? 0;
}

/**
 * Returns YYYY-MM-DD for next Saturday in ET.
 * If today is already Saturday, returns today.
 */
function getNextSaturday(now: Date): string {
  const dow = getETDayOfWeek(now);
  const daysUntilSat = (6 - dow + 7) % 7; // 0 if today is Saturday
  const target = new Date(now);
  target.setDate(target.getDate() + daysUntilSat);
  return getLocalDateString(target);
}

/**
 * Returns YYYY-MM-DD for next Sunday in ET.
 * If today is already Sunday, returns today.
 */
function getNextSunday(now: Date): string {
  const dow = getETDayOfWeek(now);
  const daysUntilSun = (7 - dow) % 7; // 0 if today is Sunday
  const target = new Date(now);
  target.setDate(target.getDate() + daysUntilSun);
  return getLocalDateString(target);
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

type RouteContext = { params: Promise<{ slug: string }> };

export const revalidate = 900; // 15-minute ISR

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await context.params;
  const requestSlug = normalizePortalSlug(slug);
  const canonicalSlug = resolvePortalSlugAlias(requestSlug);

  const supabase = await createClient();

  // Resolve portal to get city filter
  const { data: portalData } = await supabase
    .from("portals")
    .select("id, filters")
    .eq("slug", canonicalSlug)
    .eq("status", "active")
    .maybeSingle() as unknown as {
      data: { id: string; filters: Record<string, unknown> | string | null } | null;
    };

  if (!portalData) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  // Parse city from portal filters
  let portalCity = "Atlanta";
  try {
    const filters =
      typeof portalData.filters === "string"
        ? JSON.parse(portalData.filters)
        : portalData.filters ?? {};
    if (filters.city && typeof filters.city === "string") {
      portalCity = filters.city;
    }
  } catch {
    // keep default
  }

  const now = new Date();
  const today = getLocalDateString(now);
  const etDayOfWeek = getETDayOfWeek(now);

  const nextSaturday = getNextSaturday(now);
  const nextSunday = getNextSunday(now);

  const fourteenDaysFromNow = (() => {
    const d = new Date(now);
    d.setDate(d.getDate() + 14);
    return getLocalDateString(d);
  })();

  const thirtyDaysAgo = (() => {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  })();

  // -------------------------------------------------------------------------
  // Collection 4 (Family Sunday) is only generated on Saturday (6) or Sunday (0)
  // -------------------------------------------------------------------------
  const isWeekend = etDayOfWeek === 0 || etDayOfWeek === 6;

  // -------------------------------------------------------------------------
  // Run all queries in parallel
  // -------------------------------------------------------------------------

  type CountResult = { count: number | null };

  const [
    freeWeekendResult,
    dateNightNeighborhoodResult,
    newPlacesResult,
    familySundayResult,
    closingSoonResult,
  ] = await Promise.all([
    // 1. Free This Weekend — portal-scoped
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("is_free", true)
      .eq("is_active", true)
      .or(`portal_id.eq.${portalData.id},portal_id.is.null`)
      .in("start_date", [nextSaturday, nextSunday])
      .limit(10) as unknown as Promise<CountResult & { error: unknown }>,

    // 2. Date Night — find tonight's top neighborhood, portal-scoped via city
    supabase
      .from("events")
      .select("places!events_place_id_fkey(neighborhood, city)")
      .eq("is_active", true)
      .eq("start_date", today)
      .or(`portal_id.eq.${portalData.id},portal_id.is.null`)
      .not("places.neighborhood", "is", null)
      .eq("places.city", portalCity)
      .limit(200) as unknown as Promise<{
        data: Array<{ places: { neighborhood: string; city: string } | null }> | null;
        error: unknown;
      }>,

    // 3. New in Atlanta — places created in last 30 days (already city-scoped)
    supabase
      .from("places")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("city", portalCity)
      .gte("created_at", thirtyDaysAgo)
      .limit(10) as unknown as Promise<CountResult & { error: unknown }>,

    // 4. Family Sunday (only on Sat/Sun) — portal-scoped
    isWeekend
      ? (supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("category_id", "family")
          .eq("is_active", true)
          .or(`portal_id.eq.${portalData.id},portal_id.is.null`)
          .eq("start_date", nextSunday)
          .limit(10) as unknown as Promise<CountResult & { error: unknown }>)
      : Promise.resolve({ count: 0, error: null }),

    // 5. Closing Soon — exhibitions closing in next 14 days
    // Note: exhibitions table has no portal_id; scoped via place city
    supabase
      .from("exhibitions")
      .select("id, place:places!inner(city)", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("place.city", portalCity)
      .gte("closing_date", today)
      .lte("closing_date", fourteenDaysFromNow)
      .limit(10) as unknown as Promise<CountResult & { error: unknown }>,
  ]);

  // -------------------------------------------------------------------------
  // Derive Date Night neighborhood from raw rows
  // -------------------------------------------------------------------------
  let topNeighborhood: string | null = null;
  let dateNightCount = 0;

  if (dateNightNeighborhoodResult.data && dateNightNeighborhoodResult.data.length > 0) {
    const tally = new Map<string, number>();
    for (const row of dateNightNeighborhoodResult.data) {
      const n = row.places?.neighborhood;
      if (n) {
        tally.set(n, (tally.get(n) ?? 0) + 1);
      }
    }
    if (tally.size > 0) {
      const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
      topNeighborhood = sorted[0][0];
      dateNightCount = Math.min(sorted[0][1], 10);
    }
  }

  // -------------------------------------------------------------------------
  // Assemble collections, excluding 0-count results
  // -------------------------------------------------------------------------
  const rawCollections: Array<Collection & { _count: number }> = [
    {
      title: "Free This Weekend",
      _count: freeWeekendResult.count ?? 0,
      count: Math.min(freeWeekendResult.count ?? 0, 10),
      slug: "free-this-weekend",
      categories: ["All free"],
      href: `/${canonicalSlug}?view=find&free=true&date=weekend`,
    },
    {
      title: topNeighborhood ? `Date Night: ${topNeighborhood}` : "Date Night",
      _count: dateNightCount,
      count: dateNightCount,
      slug: "date-night",
      categories: ["Dining", "Shows"],
      href: topNeighborhood
        ? `/${canonicalSlug}?view=find&neighborhoods=${encodeURIComponent(topNeighborhood)}`
        : `/${canonicalSlug}?view=find`,
    },
    {
      title: `New in ${portalCity}`,
      _count: newPlacesResult.count ?? 0,
      count: Math.min(newPlacesResult.count ?? 0, 10),
      slug: "new-in-city",
      categories: ["New spots"],
      href: `/${canonicalSlug}?view=find`,
    },
    {
      title: "Family Sunday",
      _count: familySundayResult.count ?? 0,
      count: Math.min(familySundayResult.count ?? 0, 10),
      slug: "family-sunday",
      categories: ["Kid-friendly"],
      href: `/${canonicalSlug}?view=find&categories=family&date=weekend`,
    },
    {
      title: "Closing Soon",
      _count: closingSoonResult.count ?? 0,
      count: Math.min(closingSoonResult.count ?? 0, 10),
      slug: "closing-soon",
      categories: ["Arts", "Exhibitions"],
      href: `/${canonicalSlug}?view=find&lane=arts`,
    },
  ];

  const collections: Collection[] = rawCollections
    .filter((c) => c._count > 0)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(({ _count, ...rest }) => rest);

  const response: CollectionsResponse = { collections };

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
    },
  });
}
