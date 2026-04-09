import { NextRequest, NextResponse } from "next/server";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import {
  normalizePortalSlug,
  resolvePortalSlugAlias,
} from "@/lib/portal-aliases";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";
import { createServerTimingRecorder } from "@/lib/server-timing";
import { loadPortalFeed } from "@/lib/portal-feed-loader";

export const revalidate = 300;

const FEED_CACHE_TTL_MS = 5 * 60 * 1000;
const FEED_CACHE_MAX_ENTRIES = 200;
const FEED_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=3600";
const FEED_CACHE_NAMESPACE = "api:portal-feed";
const FEED_CACHE_VERSION = "v3";
const FEED_IN_FLIGHT_LOADS = new Map<
  string,
  Promise<{ payload: unknown; serverTiming: string; status?: number }>
>();

type Props = {
  params: Promise<{ slug: string }>;
};

async function getCachedFeedPayload(cacheKey: string): Promise<unknown | null> {
  return getSharedCacheJson<unknown>(FEED_CACHE_NAMESPACE, cacheKey);
}

async function setCachedFeedPayload(
  cacheKey: string,
  payload: unknown,
): Promise<void> {
  await setSharedCacheJson(
    FEED_CACHE_NAMESPACE,
    cacheKey,
    payload,
    FEED_CACHE_TTL_MS,
    { maxEntries: FEED_CACHE_MAX_ENTRIES },
  );
}

export async function GET(request: NextRequest, { params }: Props) {
  const timing = createServerTimingRecorder();

  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.feed,
    getClientIdentifier(request),
    {
      bucket: "feed:portal",
      logContext: "feed:portal",
    },
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  const requestSlug = normalizePortalSlug(slug);
  const canonicalSlug = resolvePortalSlugAlias(requestSlug);
  const { searchParams } = new URL(request.url);
  const sectionIds = searchParams.get("sections")?.split(",").filter(Boolean);
  const parsedLimit = Number.parseInt(searchParams.get("limit") || "5", 10);
  const defaultLimit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(parsedLimit, 50))
    : 5;
  const sectionKey = (sectionIds || []).slice().sort().join(",");
  const currentHour = new Date().getHours().toString().padStart(2, "0");
  const cacheKey =
    `${FEED_CACHE_VERSION}|${canonicalSlug}|${defaultLimit}|${sectionKey}|${currentHour}`;

  const cachedPayload = await timing.measure("cache_lookup", () =>
    getCachedFeedPayload(cacheKey),
  );
  if (cachedPayload) {
    timing.addMetric("cache_hit", 0, "shared");
    return NextResponse.json(cachedPayload, {
      headers: {
        "Cache-Control": FEED_CACHE_CONTROL,
        "Server-Timing": timing.toHeader(),
      },
    });
  }

  const existingFeedLoad = FEED_IN_FLIGHT_LOADS.get(cacheKey);
  if (existingFeedLoad) {
    const result = await existingFeedLoad;
    timing.addMetric("coalesced", 0, "inflight");
    return NextResponse.json(result.payload, {
      status: result.status,
      headers: {
        "Cache-Control": FEED_CACHE_CONTROL,
        "Server-Timing": `${result.serverTiming}, ${timing.toHeader()}`,
      },
    });
  }

  const feedLoadPromise = loadPortalFeed({
    canonicalSlug,
    requestSlug,
    sectionIds,
    defaultLimit,
    timing,
  });

  FEED_IN_FLIGHT_LOADS.set(cacheKey, feedLoadPromise);
  try {
    const result = await feedLoadPromise;
    if (!result.status || result.status < 400) {
      await setCachedFeedPayload(cacheKey, result.payload);
    }
    return NextResponse.json(result.payload, {
      status: result.status,
      headers: {
        "Cache-Control": FEED_CACHE_CONTROL,
        "Server-Timing": result.serverTiming,
      },
    });
  } finally {
    const currentFeedLoad = FEED_IN_FLIGHT_LOADS.get(cacheKey);
    if (currentFeedLoad === feedLoadPromise) {
      FEED_IN_FLIGHT_LOADS.delete(cacheKey);
    }
  }
}
