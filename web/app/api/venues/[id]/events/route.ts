import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getLocalDateString } from "@/lib/formats";
import { errorResponse, isValidUUID } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const rawLimit = parseInt(searchParams.get("limit") || "10", 10);
  const limit = Math.min(Math.max(isNaN(rawLimit) ? 10 : rawLimit, 1), 100);
  const portalIdParam = searchParams.get("portal_id");

  // Validate portal_id to prevent PostgREST filter injection
  const portalId = portalIdParam && isValidUUID(portalIdParam) ? portalIdParam : null;

  const venueId = parseInt(id);
  if (isNaN(venueId)) {
    return NextResponse.json({ error: "Invalid venue ID" }, { status: 400 });
  }

  const today = getLocalDateString();

  let query = supabase
    .from("events")
    .select(`
      id,
      title,
      start_date,
      start_time,
      end_time,
      is_all_day,
      category,
      series:series_id(slug)
    `)
    .eq("venue_id", venueId)
    .gte("start_date", today)
    .is("canonical_event_id", null) // Only show canonical events, not duplicates
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(limit);

  // Filter by portal to prevent cross-portal leakage
  if (portalId) {
    query = query.or(`portal_id.eq.${portalId},portal_id.is.null`);
  }

  const { data: events, error } = await query;

  if (error) {
    return errorResponse(error, "GET /api/venues/[id]/events");
  }

  // Flatten series join into series_slug for the client
  const flatEvents = (events || []).map((e: Record<string, unknown>) => {
    const series = e.series as { slug: string } | null;
    return {
      ...e,
      series_slug: series?.slug || null,
      series: undefined,
    };
  });

  return NextResponse.json({ events: flatEvents });
}
