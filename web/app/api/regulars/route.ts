import { NextRequest, NextResponse } from "next/server";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { getVerticalFromRequest } from "@/lib/portal-query-context";
import {
  getRegularsPayload,
} from "@/lib/explore-platform/server/regulars";

const CACHE_CONTROL = "public, s-maxage=180, stale-while-revalidate=360";

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);
  const compact = searchParams.get("compact") === "1";

  try {
    const payload = await getRegularsPayload({
      searchParams,
      vertical: getVerticalFromRequest(request),
    });

    const events = compact
      ? payload.events.map((event) => ({
          id: event.id,
          title: event.title,
          start_date: event.start_date,
          start_time: event.start_time,
          is_all_day: event.is_all_day,
          venue: { name: event.venue?.name ?? null },
          activity_type: event.activity_type,
          recurrence_label: event.recurrence_label,
        }))
      : payload.events.map((event) => ({
          ...event,
          series: event.series,
          venue: event.venue
            ? {
                id: event.venue.id ?? null,
                name: event.venue.name ?? null,
              }
            : null,
        }));

    return NextResponse.json(
      { events },
      {
        headers: {
          "Cache-Control": CACHE_CONTROL,
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch regulars",
      },
      { status: 500 },
    );
  }
}
