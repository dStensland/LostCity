import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getLocalDateString } from "@/lib/formats";
import { getNeighborhoodByName } from "@/config/neighborhoods";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { getPortalBySlug } from "@/lib/portal";

// ─── Types ───────────────────────────────────────────────────────────────────

interface NeighborhoodActivityRow {
  neighborhood: string;
  events_today: number;
  events_week: number;
  venue_count: number;
  editorial_mention_count: number;
  occasion_type_count: number;
}

interface NeighborhoodActivityResult {
  name: string;
  slug: string;
  tier: 1 | 2 | 3;
  eventsTodayCount: number;
  eventsWeekCount: number;
  venueCount: number;
  editorialMentionCount: number;
  occasionTypes: number;
  activityScore: number;
  topCategories: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function computeRawScore(row: NeighborhoodActivityRow): number {
  return (
    row.events_today * 5 +
    row.events_week * 1 +
    row.venue_count * 0.5 +
    row.editorial_mention_count * 2 +
    row.occasion_type_count * 1
  );
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  try {
    const { searchParams } = request.nextUrl;
    const portalSlug = searchParams.get("portal");

    // Resolve portal_id when a portal slug is supplied
    let portalId: string | null = null;
    if (portalSlug) {
      const portal = await getPortalBySlug(portalSlug);
      portalId = portal?.id ?? null;
    }

    let serviceClient: ReturnType<typeof createServiceClient>;
    try {
      serviceClient = createServiceClient();
    } catch {
      return NextResponse.json({ neighborhoods: [] }, { status: 200 });
    }

    // ── Primary RPC: aggregate metrics per neighborhood ──────────────────────
    const { data: rpcRows, error: rpcError } = await serviceClient.rpc(
      "get_neighborhood_activity" as never,
      {
        p_portal_id: portalId,
        p_city_names: ["Atlanta"],
      } as never
    );

    if (rpcError) {
      console.error("[neighborhoods/activity] RPC error:", rpcError.message);
      return NextResponse.json({ neighborhoods: [] }, { status: 200 });
    }

    const rows = (rpcRows ?? []) as NeighborhoodActivityRow[];

    // ── Compute composite scores ─────────────────────────────────────────────
    const rawScores = rows.map(computeRawScore);
    const maxRaw = Math.max(...rawScores, 0);

    // ── Secondary query: top categories per neighborhood ─────────────────────
    const todayStr = getLocalDateString();
    const weekEndDate = new Date(todayStr + "T00:00:00");
    weekEndDate.setDate(weekEndDate.getDate() + 7);
    const weekEndStr = getLocalDateString(weekEndDate);

    const { data: eventRows, error: eventError } = await serviceClient
      .from("events")
      .select("category_id, venue:venues!events_venue_id_fkey(neighborhood)")
      .eq("is_active", true)
      .is("canonical_event_id", null)
      .gte("start_date", todayStr)
      .lte("start_date", weekEndStr);

    // Group category counts by neighborhood → category
    const categoryCountsByNeighborhood: Record<string, Record<string, number>> =
      {};

    if (!eventError && eventRows) {
      for (const row of eventRows as { category_id: string | null; venue: { neighborhood: string | null } | null }[]) {
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

    const NOISE_CATEGORIES = new Set(['support_group', 'unknown', 'recreation']);

    // Pick top 3 categories per neighborhood (excluding noise categories)
    function topCategories(neighborhood: string): string[] {
      const counts = categoryCountsByNeighborhood[neighborhood];
      if (!counts) return [];
      return Object.entries(counts)
        .filter(([cat]) => !NOISE_CATEGORIES.has(cat))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat]) => cat);
    }

    // ── Build response payload ───────────────────────────────────────────────
    const neighborhoods: NeighborhoodActivityResult[] = rows.map((row, i) => {
      const configEntry = getNeighborhoodByName(row.neighborhood);
      // Fall back gracefully if the neighborhood isn't in our config
      const tier: 1 | 2 | 3 = configEntry?.tier ?? 3;
      const rawScore = rawScores[i];
      const activityScore =
        maxRaw > 0 ? Math.round((rawScore / maxRaw) * 100) : 0;

      return {
        name: row.neighborhood,
        slug: buildSlug(row.neighborhood),
        tier,
        eventsTodayCount: Number(row.events_today),
        eventsWeekCount: Number(row.events_week),
        venueCount: Number(row.venue_count),
        editorialMentionCount: Number(row.editorial_mention_count),
        occasionTypes: Number(row.occasion_type_count),
        activityScore,
        topCategories: topCategories(row.neighborhood),
      };
    });

    return NextResponse.json(
      { neighborhoods },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("[neighborhoods/activity] Unexpected error:", error);
    return NextResponse.json({ neighborhoods: [] }, { status: 200 });
  }
}
