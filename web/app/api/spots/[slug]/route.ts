import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { getSpotDetail, type SpotDetailPayload } from "@/lib/spot-detail";

const SPOT_DETAIL_CACHE_TTL_MS = 2 * 60 * 1000;
const SPOT_DETAIL_CACHE_MAX_ENTRIES = 200;
const SPOT_DETAIL_CACHE_CONTROL = "public, max-age=60, s-maxage=120, stale-while-revalidate=600";

const spotDetailPayloadCache = new Map<
  string,
  { expiresAt: number; payload: SpotDetailPayload }
>();

function getCachedSpotDetailPayload(cacheKey: string): SpotDetailPayload | null {
  const entry = spotDetailPayloadCache.get(cacheKey);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    spotDetailPayloadCache.delete(cacheKey);
    return null;
  }
  return entry.payload;
}

function setCachedSpotDetailPayload(cacheKey: string, payload: SpotDetailPayload): void {
  if (spotDetailPayloadCache.size >= SPOT_DETAIL_CACHE_MAX_ENTRIES) {
    const firstKey = spotDetailPayloadCache.keys().next().value;
    if (firstKey) {
      spotDetailPayloadCache.delete(firstKey);
    }
  }
  spotDetailPayloadCache.set(cacheKey, {
    expiresAt: Date.now() + SPOT_DETAIL_CACHE_TTL_MS,
    payload,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;

  if (!slug) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const cacheKey = slug.toLowerCase().trim();
  const cachedPayload = getCachedSpotDetailPayload(cacheKey);
  if (cachedPayload) {
    return NextResponse.json(cachedPayload, {
      headers: { "Cache-Control": SPOT_DETAIL_CACHE_CONTROL },
    });
  }

  const payload = await getSpotDetail(slug);

  if (!payload) {
    return NextResponse.json({ error: "Spot not found" }, { status: 404 });
  }

  setCachedSpotDetailPayload(cacheKey, payload);

  return NextResponse.json(payload, {
    headers: { "Cache-Control": SPOT_DETAIL_CACHE_CONTROL },
  });
}
