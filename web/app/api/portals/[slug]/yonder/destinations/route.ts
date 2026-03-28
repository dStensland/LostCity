import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import {
  normalizePortalSlug,
  resolvePortalSlugAlias,
} from "@/lib/portal-aliases";
import {
  getSharedCacheJson,
  setSharedCacheJson,
} from "@/lib/shared-cache";
import {
  YONDER_DESTINATION_INTELLIGENCE,
  type YonderDestinationIntelligence,
} from "@/config/yonder-destination-intelligence";
import {
  getYonderAccommodationInventorySource,
  type YonderAccommodationInventorySource,
} from "@/config/yonder-accommodation-inventory";
import type { YonderRuntimeInventorySnapshot } from "@/lib/yonder-provider-inventory";

const CACHE_NAMESPACE = "api:yonder-destinations";
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

type Props = {
  params: Promise<{ slug: string }>;
};

type YonderDestinationCard = YonderDestinationIntelligence & {
  id: number;
  city: string | null;
  state: string | null;
  imageUrl: string | null;
  shortDescription: string | null;
  venueType: string | null;
  reservationUrl: string | null;
  acceptsReservations: boolean | null;
  reservationRecommended: boolean | null;
  accommodationInventorySource: YonderAccommodationInventorySource | null;
  runtimeInventorySnapshot: YonderRuntimeInventorySnapshot | null;
};

export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  const canonicalSlug = resolvePortalSlugAlias(normalizePortalSlug(slug));

  if (canonicalSlug !== "yonder") {
    return NextResponse.json(
      { destinations: [] satisfies YonderDestinationCard[] },
      { headers: { "Cache-Control": CACHE_CONTROL } },
    );
  }

  const cacheBucket = Math.floor(Date.now() / CACHE_TTL_MS);
  const cacheKey = `${canonicalSlug}|${cacheBucket}`;
  const cached = await getSharedCacheJson<{ destinations: YonderDestinationCard[] }>(
    CACHE_NAMESPACE,
    cacheKey,
  );
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": CACHE_CONTROL },
    });
  }

  const supabase = await createClient();
  const slugs = YONDER_DESTINATION_INTELLIGENCE.map((entry) => entry.slug);
  const { data } = await supabase
    .from("places")
    .select(
      "id, slug, city, state, image_url, hero_image_url, short_description, place_type, reservation_url, accepts_reservations, reservation_recommended",
    )
    .in("slug", slugs)
    .eq("is_active", true);

  const rowsBySlug = new Map(
    ((data ?? []) as Array<{
      id: number;
      slug: string;
      city: string | null;
      state: string | null;
      image_url: string | null;
      hero_image_url: string | null;
      short_description: string | null;
      venue_type: string | null;
      reservation_url: string | null;
      accepts_reservations: boolean | null;
      reservation_recommended: boolean | null;
    }>).map((row) => [row.slug, row]),
  );

  const destinations = YONDER_DESTINATION_INTELLIGENCE.map((entry) => {
    const row = rowsBySlug.get(entry.slug);
    if (!row) return null;
    return {
      ...entry,
      id: row.id,
      city: row.city,
      state: row.state,
      imageUrl: row.image_url || row.hero_image_url,
      shortDescription: row.short_description,
      venueType: row.venue_type,
      reservationUrl: row.reservation_url,
      acceptsReservations: row.accepts_reservations,
      reservationRecommended: row.reservation_recommended,
      accommodationInventorySource: getYonderAccommodationInventorySource(
        entry.slug,
      ),
      runtimeInventorySnapshot: null as YonderRuntimeInventorySnapshot | null,
    } satisfies YonderDestinationCard;
  });

  const filteredDestinations = destinations.filter(
    (entry): entry is YonderDestinationCard => entry !== null,
  );

  const result = { destinations: filteredDestinations };
  await setSharedCacheJson(CACHE_NAMESPACE, cacheKey, result, CACHE_TTL_MS);

  return NextResponse.json(result, {
    headers: { "Cache-Control": CACHE_CONTROL },
  });
}
