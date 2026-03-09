import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { parseIntParam } from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import { ENABLE_HANGS_V1 } from "@/lib/launch-flags";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import type { HotVenue } from "@/lib/types/hangs";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 32;

/**
 * GET /api/hangs/hot
 * Returns venues with the most active public hangs right now.
 * Auth optional — this is public data; portal context narrows the scope.
 *
 * Query params:
 *   portal      - portal slug
 *   portal_id   - portal UUID
 *   limit       - number of venues to return (default 8, max 32)
 */
export async function GET(request: NextRequest) {
  if (!ENABLE_HANGS_V1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);
  const limitParam = parseIntParam(searchParams.get("limit"));
  const limit = Math.min(limitParam !== null && limitParam > 0 ? limitParam : DEFAULT_LIMIT, MAX_LIMIT);

  // Optional auth
  const supabase = await createClient();
  await supabase.auth.getUser(); // establishes session cookie context; result unused

  const serviceClient = createServiceClient();

  try {
    // Resolve portal context for scoping
    const portalContext = await resolvePortalQueryContext(supabase, searchParams);
    const portalId = portalContext.portalId ?? null;

    // Call RPC — returns venues ordered by active hang count desc
    const { data: hotRows, error: hotError } = await serviceClient.rpc("get_hot_venues" as never, {
      p_portal_id: portalId,
      p_limit: limit,
    } as never);

    if (hotError) {
      logger.error("Hot venues RPC error", hotError, { portalId, component: "hangs/hot" });
      return NextResponse.json({ error: "Failed to fetch hot venues" }, { status: 500 });
    }

    type HotVenueRow = {
      venue_id: number;
      venue_name: string;
      venue_slug: string | null;
      venue_image_url: string | null;
      venue_neighborhood: string | null;
      active_count: number | string; // BIGINT may come through as string from some drivers
    };

    const rows = (hotRows ?? []) as HotVenueRow[];

    // For each hot venue, look up whether there's a current event happening
    // Batch fetch: single query for all venue IDs to avoid N+1
    const venueIds = rows.map((r) => r.venue_id);

    let currentEventsByVenue: Map<number, string> = new Map();

    if (venueIds.length > 0) {
      const now = new Date();
      const todayDate = now.toISOString().slice(0, 10);
      const currentTimeStr = now.toTimeString().slice(0, 8); // HH:MM:SS

      const { data: eventRows, error: eventError } = await serviceClient
        .from("events")
        .select("id, title, venue_id, start_time, end_time")
        .in("venue_id", venueIds)
        .eq("start_date", todayDate)
        .not("start_time", "is", null)
        .lte("start_time", currentTimeStr)
        .is("canonical_event_id", null)
        .order("start_time", { ascending: false })
        .limit(venueIds.length * 2); // at most 2 per venue to handle ties

      if (eventError) {
        // Non-fatal — hot venues still useful without current event title
        logger.error("Hot venues current event query error", eventError, { component: "hangs/hot" });
      } else {
        type EventRow = {
          id: number;
          title: string;
          venue_id: number;
          start_time: string | null;
          end_time: string | null;
        };

        const events = (eventRows ?? []) as EventRow[];

        for (const event of events) {
          // Skip if already found an event for this venue
          if (currentEventsByVenue.has(event.venue_id)) continue;

          // Check the event hasn't ended
          if (event.end_time) {
            if (currentTimeStr >= event.end_time) continue;
          } else {
            // No end time — assume 3 hours
            const [startH, startM] = (event.start_time ?? "00:00").split(":").map(Number);
            const startMinutes = startH * 60 + startM;
            const [nowH, nowM] = currentTimeStr.split(":").map(Number);
            const nowMinutes = nowH * 60 + nowM;
            if (nowMinutes >= startMinutes + 180) continue;
          }

          currentEventsByVenue.set(event.venue_id, event.title);
        }
      }
    }

    // Compute total active hangs city-wide (sum of all returned rows)
    const totalActive = rows.reduce(
      (sum, row) => sum + Number(row.active_count),
      0
    );

    const venues: HotVenue[] = rows.map((row) => ({
      venue_id: row.venue_id,
      venue_name: row.venue_name,
      venue_slug: row.venue_slug,
      venue_image_url: row.venue_image_url,
      neighborhood: row.venue_neighborhood,
      active_count: Number(row.active_count),
      current_event: currentEventsByVenue.get(row.venue_id) ?? null,
    }));

    return NextResponse.json(
      { venues, total_active: totalActive },
      {
        headers: {
          "Cache-Control": "public, max-age=60",
        },
      }
    );
  } catch (err) {
    logger.error("Hot venues API error", err, { component: "hangs/hot" });
    return NextResponse.json({ error: "Failed to fetch hot venues" }, { status: 500 });
  }
}
