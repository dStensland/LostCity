import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";
import { checkBodySize, checkParsedBodySize, isValidUUID } from "@/lib/api-utils";
import { ENABLE_INTEREST_CHANNELS_V1 } from "@/lib/launch-flags";
import { refreshEventChannelMatchesForPortal } from "@/lib/interest-channel-matches";
import { filterPortalsByInterestChannelRefreshCadence } from "@/lib/interest-channel-refresh-schedule";

export const dynamic = "force-dynamic";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

type PortalRow = {
  id: string;
  slug: string;
  status: string;
  settings: Record<string, unknown> | null;
};

type RefreshRequestBody = {
  portal_id?: string;
  portal_slug?: string;
  start_date?: string;
  end_date?: string;
  max_events?: number;
  continue_on_error?: boolean;
};

function apiDisabledResponse() {
  return NextResponse.json(
    { error: "Interest Channels API is disabled." },
    { status: 404 },
  );
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE_REGEX.test(value);
}

function isAuthorized(request: NextRequest): boolean {
  const expectedKey = process.env.INTEREST_CHANNELS_REFRESH_API_KEY;
  if (!expectedKey) return false;

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : "";

  if (!token || token.length !== expectedKey.length) return false;

  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expectedKey));
  } catch {
    return false;
  }
}

async function resolveDefaultPortalTargets(): Promise<PortalRow[]> {
  const db = createServiceClient();

  const { data: channelsData, error: channelsError } = await db
    .from("interest_channels")
    .select("portal_id")
    .eq("is_active", true);

  if (channelsError) {
    throw new Error(`Failed loading active channels: ${channelsError.message}`);
  }

  const channelPortalIds = new Set<string>();
  let hasGlobalChannels = false;

  for (const row of (channelsData || []) as Array<{ portal_id: string | null }>) {
    if (row.portal_id) {
      channelPortalIds.add(row.portal_id);
    } else {
      hasGlobalChannels = true;
    }
  }

  let portalsQuery = db
    .from("portals")
    .select("id, slug, status, settings")
    .eq("status", "active");

  if (!hasGlobalChannels) {
    const scopedIds = [...channelPortalIds];
    if (scopedIds.length === 0) return [];
    portalsQuery = portalsQuery.in("id", scopedIds);
  }

  const { data: portalsData, error: portalsError } = await portalsQuery;
  if (portalsError) {
    throw new Error(`Failed loading target portals: ${portalsError.message}`);
  }

  return (portalsData || []) as PortalRow[];
}

async function resolveExplicitPortalTarget(body: RefreshRequestBody): Promise<PortalRow | null> {
  const db = createServiceClient();

  if (body.portal_id) {
    if (!isValidUUID(body.portal_id)) {
      throw new Error("portal_id must be a valid UUID");
    }

    const { data, error } = await db
      .from("portals")
      .select("id, slug, status, settings")
      .eq("id", body.portal_id)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw new Error(`Failed resolving portal_id: ${error.message}`);
    return (data as PortalRow | null) || null;
  }

  if (body.portal_slug) {
    const { data, error } = await db
      .from("portals")
      .select("id, slug, status, settings")
      .eq("slug", body.portal_slug)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw new Error(`Failed resolving portal_slug: ${error.message}`);
    return (data as PortalRow | null) || null;
  }

  return null;
}

// POST /api/cron/interest-channel-matches
// Secure machine endpoint for scheduled refreshes.
export async function POST(request: NextRequest) {
  if (!ENABLE_INTEREST_CHANNELS_V1) return apiDisabledResponse();

  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.standard,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const sizeCheck = checkBodySize(request, 4096);
  if (sizeCheck) return sizeCheck;

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RefreshRequestBody = {};
  try {
    body = (await request.json()) as RefreshRequestBody;
  } catch {
    body = {};
  }

  const parsedSizeCheck = checkParsedBodySize(body, 4096);
  if (parsedSizeCheck) return parsedSizeCheck;

  if (body.start_date !== undefined && !isIsoDate(body.start_date)) {
    return NextResponse.json({ error: "start_date must be YYYY-MM-DD" }, { status: 400 });
  }
  if (body.end_date !== undefined && !isIsoDate(body.end_date)) {
    return NextResponse.json({ error: "end_date must be YYYY-MM-DD" }, { status: 400 });
  }
  if (body.max_events !== undefined) {
    if (!Number.isInteger(body.max_events) || body.max_events <= 0 || body.max_events > 100000) {
      return NextResponse.json(
        { error: "max_events must be an integer between 1 and 100000" },
        { status: 400 },
      );
    }
  }

  try {
    const explicitTarget = await resolveExplicitPortalTarget(body);
    const skippedBySchedule: Array<{
      portal_id: string;
      portal_slug: string;
      cadence: "hourly" | "daily" | "disabled";
      hour_utc: number | null;
      reason: "disabled" | "outside_daily_window";
    }> = [];
    let resolvedTargetPortals: PortalRow[] = [];

    if (explicitTarget) {
      resolvedTargetPortals = [explicitTarget];
    } else {
      const defaultTargets = await resolveDefaultPortalTargets();
      const scheduled = filterPortalsByInterestChannelRefreshCadence(defaultTargets);
      resolvedTargetPortals = scheduled.eligible;
      skippedBySchedule.push(
        ...scheduled.skipped.map((portal) => ({
          portal_id: portal.id,
          portal_slug: portal.slug,
          cadence: portal.cadence,
          hour_utc: portal.hour_utc,
          reason: portal.reason,
        })),
      );
    }

    const continueOnError = body.continue_on_error ?? true;
    const successes: Array<{
      portal_id: string;
      portal_slug: string;
      events_scanned: number;
      matches_written: number;
      channels_considered: number;
      completed_at: string;
    }> = [];
    const failures: Array<{ portal_id: string; portal_slug: string; error: string }> = [];

    for (const portal of resolvedTargetPortals) {
      try {
        const result = await refreshEventChannelMatchesForPortal(
          createServiceClient(),
          portal.id,
          {
            startDate: body.start_date,
            endDate: body.end_date,
            maxEvents: body.max_events,
          },
        );

        successes.push({
          portal_id: portal.id,
          portal_slug: portal.slug,
          events_scanned: result.eventsScanned,
          matches_written: result.matchesWritten,
          channels_considered: result.channelsConsidered,
          completed_at: result.completedAt,
        });
      } catch (error) {
        failures.push({
          portal_id: portal.id,
          portal_slug: portal.slug,
          error: error instanceof Error ? error.message : "Unknown refresh failure",
        });

        if (!continueOnError) {
          return NextResponse.json(
            {
              success: false,
              error: "Refresh halted after first failure",
              refreshed_portals: successes,
              failed_portals: failures,
              skipped_by_schedule: skippedBySchedule,
            },
            { status: 500 },
          );
        }
      }
    }

    return NextResponse.json({
      success: failures.length === 0,
      requested_portals: resolvedTargetPortals.length,
      refreshed_portals: successes,
      failed_portals: failures,
      skipped_by_schedule: skippedBySchedule,
      window: {
        start_date: body.start_date || null,
        end_date: body.end_date || null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to refresh interest channel matches",
      },
      { status: 500 },
    );
  }
}
