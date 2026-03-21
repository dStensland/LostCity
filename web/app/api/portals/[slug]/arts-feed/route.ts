import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { getLocalDateString } from "@/lib/formats";
import { addDays } from "date-fns";
import { getPortalSourceAccess } from "@/lib/federation";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/portals/[slug]/arts-feed
 *
 * Lightweight endpoint for the Arts vertical feed.
 * Returns events from the portal's subscribed sources, bucketed by:
 *  - All upcoming events (next 30 days)
 *
 * Client-side ArtsFeedShell handles the bucketing into
 * exhibitions / closing-soon / events / classes.
 */

type Props = {
  params: Promise<{ slug: string }>;
};

export async function GET(
  request: NextRequest,
  { params }: Props,
) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  const supabase = await createClient();

  // 1. Get portal
  const { data: portal, error: portalError } = await supabase
    .from("portals")
    .select("id,slug,name,settings,filters")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (portalError || !portal) {
    return NextResponse.json(
      { error: "Portal not found" },
      { status: 404 },
    );
  }

  // 2. Get source IDs from federation
  const portalId = (portal as { id: string }).id;
  const sourceAccess = await getPortalSourceAccess(portalId);
  const sourceIds = sourceAccess.sourceIds;

  if (sourceIds.length === 0) {
    return NextResponse.json({ events: [], exhibitions: [] });
  }

  // 3. Query events and exhibitions in parallel
  const today = getLocalDateString();
  const thirtyDaysOut = getLocalDateString(addDays(new Date(), 30));

  const [eventsResult, exhibitionsResult] = await Promise.all([
    supabase
      .from("events")
      .select(
        `id, title, start_date, start_time, end_date, end_time,
         is_all_day, is_free, price_min, price_max,
         image_url, blurhash, description, tags,
         ticket_url, source_url,
         categories:category_id (id),
         venues:venue_id (id, name, neighborhood, slug, image_url, blurhash)`,
      )
      .in("source_id", sourceIds)
      .gte("start_date", today)
      .lte("start_date", thirtyDaysOut)
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: false })
      .limit(200),
    supabase
      .from("exhibitions")
      .select(
        `id, title, description, image_url, opening_date, closing_date,
         exhibition_type, admission_type, source_url, tags,
         venue:venue_id (id, name, neighborhood, slug, image_url, blurhash)`,
      )
      .eq("is_active", true)
      .or(`closing_date.gte.${today},closing_date.is.null`)
      .in("source_id", sourceIds)
      .order("opening_date", { ascending: true })
      .limit(100),
  ]);

  if (eventsResult.error) {
    console.error("[arts-feed] events query error:", eventsResult.error.message);
    return NextResponse.json({ events: [], exhibitions: [] });
  }

  // 4. Reshape event venue from join to expected format
  const shaped = (eventsResult.data ?? []).map((e) => {
    const raw = e as Record<string, unknown>;
    return {
      ...raw,
      venue: raw.venues ?? null,
      venues: undefined,
      // Resolve category from join
      category: (raw.categories as { id: string } | null)?.id ?? "art",
      categories: undefined,
      going_count: 0,
      interested_count: 0,
    };
  });

  const exhibitions = exhibitionsResult.data ?? [];

  return NextResponse.json(
    { events: shaped, exhibitions },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
