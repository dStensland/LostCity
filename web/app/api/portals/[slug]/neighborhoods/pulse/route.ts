import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getPortalBySlug } from "@/lib/portal";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { getNeighborhoodByName } from "@/config/neighborhoods";

// ─── Types ───────────────────────────────────────────────────────────────────

interface NeighborhoodActivityRow {
  neighborhood: string;
  events_today: number;
  events_week: number;
  venue_count: number;
  editorial_mention_count: number;
  occasion_type_count: number;
}

export interface NeighborhoodPulseItem {
  name: string;
  slug: string;
  tier: number;
  eventsTodayCount: number;
  eventsWeekCount: number;
  topCategories: string[];
  accentColor: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_EVENTS_TODAY = 3;
const MAX_NEIGHBORHOODS = 8;
const EXCLUDED_NEIGHBORHOODS = new Set(["Atlanta"]);
const NOISE_CATEGORIES = new Set(["support_group", "unknown", "recreation"]);

const ACCENT_COLORS = [
  "var(--vibe)",
  "var(--coral)",
  "var(--neon-green)",
  "var(--gold)",
  "var(--neon-cyan)",
  "var(--neon-magenta)",
  "var(--neon-red)",
  "var(--gold)",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type RouteContext = {
  params: Promise<{ slug: string }>;
};

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await context.params;

  try {
    // ── Resolve portal ───────────────────────────────────────────────────────
    const portal = await getPortalBySlug(slug);
    if (!portal) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    // Derive city from portal filters (mirrors pattern in happening-now)
    const portalCity =
      portal.portal_type === "business"
        ? undefined
        : portal.filters &&
          typeof portal.filters === "object" &&
          !Array.isArray(portal.filters) &&
          "city" in portal.filters &&
          typeof (portal.filters as { city?: unknown }).city === "string"
        ? (portal.filters as { city: string }).city
        : undefined;

    // city names array — fall back to Atlanta if not specified
    const cityNames = portalCity ? [portalCity] : ["Atlanta"];

    let serviceClient: ReturnType<typeof createServiceClient>;
    try {
      serviceClient = createServiceClient();
    } catch {
      return NextResponse.json({ neighborhoods: [] }, { status: 200 });
    }

    // ── RPC: per-neighborhood aggregate metrics ──────────────────────────────
    const { data: rpcRows, error: rpcError } = await serviceClient.rpc(
      "get_neighborhood_activity" as never,
      {
        p_portal_id: portal.id,
        p_city_names: cityNames,
      } as never
    );

    if (rpcError) {
      console.error("[neighborhoods/pulse] RPC error:", rpcError.message);
      return NextResponse.json({ neighborhoods: [] }, { status: 200 });
    }

    const rows = (rpcRows ?? []) as NeighborhoodActivityRow[];

    // ── Secondary query: top categories per neighborhood (this week) ─────────
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    const { data: eventRows, error: eventError } = await serviceClient
      .from("events")
      .select("category_id, venue:places!events_place_id_fkey(neighborhood)")
      .eq("is_active", true)
      .is("canonical_event_id", null)
      .gte("start_date", todayStr)
      .lte("start_date", weekEndStr);

    // Build neighborhood → category count map
    const categoryCountsByNeighborhood: Record<string, Record<string, number>> = {};

    if (!eventError && eventRows) {
      for (const row of eventRows as {
        category_id: string | null;
        venue: { neighborhood: string | null } | null;
      }[]) {
        const neighborhood = row.venue?.neighborhood;
        const category = row.category_id;
        if (!neighborhood || !category) continue;

        if (!categoryCountsByNeighborhood[neighborhood]) {
          categoryCountsByNeighborhood[neighborhood] = {};
        }
        categoryCountsByNeighborhood[neighborhood][category] =
          (categoryCountsByNeighborhood[neighborhood][category] ?? 0) + 1;
      }
    }

    function topCategoriesFor(neighborhood: string): string[] {
      const counts = categoryCountsByNeighborhood[neighborhood];
      if (!counts) return [];
      return Object.entries(counts)
        .filter(([cat]) => !NOISE_CATEGORIES.has(cat))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat]) => cat);
    }

    // ── Filter, sort, cap, assign accent colors ──────────────────────────────
    const neighborhoods: NeighborhoodPulseItem[] = rows
      .filter(
        (row) =>
          Number(row.events_today) >= MIN_EVENTS_TODAY &&
          !EXCLUDED_NEIGHBORHOODS.has(row.neighborhood)
      )
      .sort((a, b) => Number(b.events_today) - Number(a.events_today))
      .slice(0, MAX_NEIGHBORHOODS)
      .map((row, i) => {
        const configEntry = getNeighborhoodByName(row.neighborhood);
        const tier: number = configEntry?.tier ?? 3;

        return {
          name: row.neighborhood,
          slug: buildSlug(row.neighborhood),
          tier,
          eventsTodayCount: Number(row.events_today),
          eventsWeekCount: Number(row.events_week),
          topCategories: topCategoriesFor(row.neighborhood),
          accentColor: ACCENT_COLORS[i % ACCENT_COLORS.length],
        };
      });

    return NextResponse.json(
      { neighborhoods },
      {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
        },
      }
    );
  } catch (error) {
    console.error("[neighborhoods/pulse] Unexpected error:", error);
    return NextResponse.json({ neighborhoods: [] }, { status: 200 });
  }
}
