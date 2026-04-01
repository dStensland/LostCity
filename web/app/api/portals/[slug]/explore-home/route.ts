// web/app/api/portals/[slug]/explore-home/route.ts

import { NextResponse } from "next/server";
import { getExploreHomeData } from "@/lib/explore-home-data";
import {
  getSharedCacheJson,
  setSharedCacheJson,
} from "@/lib/shared-cache";
import { getTimeSlot } from "@/lib/city-pulse/time-slots";

const CACHE_NAMESPACE = "api:explore-home";
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 min
const CACHE_MAX_ENTRIES = 50;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
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

  // Write cache
  await setSharedCacheJson(CACHE_NAMESPACE, cacheKey, data, CACHE_TTL_MS, {
    maxEntries: CACHE_MAX_ENTRIES,
  });

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
    },
  });
}
