// web/app/api/portals/[slug]/explore-home/route.ts

import { NextResponse } from "next/server";
import { getExploreHomeData } from "@/lib/explore-home-data";
import {
  getSharedCacheJson,
  setSharedCacheJson,
} from "@/lib/shared-cache";
import { getTimeSlot } from "@/lib/city-pulse/time-slots";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

const CACHE_NAMESPACE = "api:explore-home";
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 min
const CACHE_MAX_ENTRIES = 50;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;

  // Time-slot cache key
  const now = new Date();
  const hourEt = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  const timeSlot = getTimeSlot(hourEt);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(now);
  const cacheKey = `${slug}|${timeSlot}|${today}`;

  // Check cache
  const cached = await getSharedCacheJson(CACHE_NAMESPACE, cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    });
  }

  // Fetch fresh data
  const data = await getExploreHomeData(slug);
  if (!data) {
    return NextResponse.json(
      { error: "Portal not found or data fetch failed" },
      { status: 404 },
    );
  }

  // Write cache — but don't cache badly degraded responses. If transient
  // query failures pushed many lanes to "zero" state, caching that response
  // means all users see degraded data for the full TTL. Heuristic: classes
  // is always zero (expected), so we count zero-state lanes excluding it.
  // If more than half of the remaining lanes are zero, something went wrong.
  const laneEntries = Object.entries(data.lanes);
  const nonClassesLanes = laneEntries.filter(([key]) => key !== "classes");
  const zeroCount = nonClassesLanes.filter(
    ([, lane]) => lane.state === "zero",
  ).length;
  const shouldCache = zeroCount <= Math.floor(nonClassesLanes.length / 2);

  if (shouldCache) {
    await setSharedCacheJson(CACHE_NAMESPACE, cacheKey, data, CACHE_TTL_MS, {
      maxEntries: CACHE_MAX_ENTRIES,
    });
  } else {
    console.warn(
      `[explore-home] Skipping cache write for "${slug}": ${zeroCount}/${nonClassesLanes.length} non-classes lanes are zero (likely degraded response)`,
    );
  }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
    },
  });
}
