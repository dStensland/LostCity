import { NextRequest, NextResponse } from "next/server";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { getVerticalFromRequest } from "@/lib/portal-query-context";
import {
  getStageShowsPayload,
  isStageCategory,
} from "@/lib/explore-platform/server/shows";

export const revalidate = 300;

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Invalid date format. Use YYYY-MM-DD." },
      { status: 400 },
    );
  }

  const filterParam = searchParams.get("filter");
  const categoryFilter = isStageCategory(filterParam) ? filterParam : null;

  try {
    const payload = await getStageShowsPayload({
      searchParams,
      vertical: getVerticalFromRequest(request),
      categoryFilter,
    });

    const response = NextResponse.json(payload);
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600",
    );
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch stage listings",
      },
      { status: 500 },
    );
  }
}
