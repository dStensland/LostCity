import { NextRequest, NextResponse } from "next/server";
import { canManagePortal } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  adminErrorResponse,
  checkBodySize,
  checkParsedBodySize,
  isValidUUID,
  type AnySupabase,
} from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { ENABLE_INTEREST_CHANNELS_V1 } from "@/lib/launch-flags";
import { resolveInterestChannelRefreshConfig } from "@/lib/interest-channel-refresh-schedule";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

type RefreshCadence = "hourly" | "daily" | "disabled";

type PortalRow = {
  id: string;
  slug: string;
  settings: Record<string, unknown> | null;
};

type UpdateScheduleBody = {
  cadence?: RefreshCadence;
  hour_utc?: number;
};

function apiDisabledResponse() {
  return NextResponse.json(
    { error: "Interest Channels API is disabled." },
    { status: 404 },
  );
}

function isValidCadence(value: unknown): value is RefreshCadence {
  return value === "hourly" || value === "daily" || value === "disabled";
}

function normalizeHourUtc(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 23) {
    return null;
  }
  return value;
}

async function requirePortalAccess(portalId: string, context: string) {
  if (!isValidUUID(portalId)) {
    return { response: NextResponse.json({ error: "Invalid portal id" }, { status: 400 }) };
  }

  if (!(await canManagePortal(portalId))) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const db = createServiceClient() as unknown as AnySupabase;
  const { data: portalData, error } = await db
    .from("portals")
    .select("id, slug, settings")
    .eq("id", portalId)
    .maybeSingle();

  if (error) {
    return { response: adminErrorResponse(error, context), db };
  }

  const portal = (portalData as PortalRow | null) || null;
  if (!portal) {
    return { response: NextResponse.json({ error: "Portal not found" }, { status: 404 }), db };
  }

  return { db, portal };
}

// GET /api/admin/portals/[id]/channels/refresh-schedule
export async function GET(request: NextRequest, { params }: Props) {
  if (!ENABLE_INTEREST_CHANNELS_V1) return apiDisabledResponse();

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId } = await params;
  const access = await requirePortalAccess(
    portalId,
    "GET /api/admin/portals/[id]/channels/refresh-schedule (portal)",
  );
  if (access.response) return access.response;
  const { portal } = access;

  const schedule = resolveInterestChannelRefreshConfig(portal.settings);
  return NextResponse.json({
    portal_id: portal.id,
    schedule: {
      cadence: schedule.cadence,
      hour_utc: schedule.hourUtc,
    },
  });
}

// PUT /api/admin/portals/[id]/channels/refresh-schedule
export async function PUT(request: NextRequest, { params }: Props) {
  if (!ENABLE_INTEREST_CHANNELS_V1) return apiDisabledResponse();

  const sizeCheck = checkBodySize(request, 2048);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId } = await params;
  const access = await requirePortalAccess(
    portalId,
    "PUT /api/admin/portals/[id]/channels/refresh-schedule (portal)",
  );
  if (access.response) return access.response;
  const { db, portal } = access;

  let body: UpdateScheduleBody;
  try {
    body = (await request.json()) as UpdateScheduleBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedSizeCheck = checkParsedBodySize(body, 2048);
  if (parsedSizeCheck) return parsedSizeCheck;

  if (!isValidCadence(body.cadence)) {
    return NextResponse.json(
      { error: "cadence must be one of: hourly, daily, disabled" },
      { status: 400 },
    );
  }

  const parsedHourUtc = normalizeHourUtc(body.hour_utc);
  if (body.cadence === "daily" && parsedHourUtc === null) {
    return NextResponse.json(
      { error: "hour_utc must be an integer between 0 and 23 when cadence=daily" },
      { status: 400 },
    );
  }
  if (body.cadence !== "daily" && body.hour_utc !== undefined) {
    return NextResponse.json(
      { error: "hour_utc is only allowed when cadence=daily" },
      { status: 400 },
    );
  }

  const nextSettings: Record<string, unknown> = {
    ...(portal.settings || {}),
    interest_channel_matches_refresh: body.cadence === "daily"
      ? { cadence: "daily", hour_utc: parsedHourUtc }
      : { cadence: body.cadence },
  };

  const { data: updatedPortalData, error: updateError } = await db
    .from("portals")
    .update({
      settings: nextSettings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", portalId)
    .select("id, settings")
    .maybeSingle();

  if (updateError) {
    return adminErrorResponse(
      updateError,
      "PUT /api/admin/portals/[id]/channels/refresh-schedule (update portal)",
    );
  }

  const updatedPortal = (updatedPortalData as { id: string; settings: Record<string, unknown> | null } | null);
  if (!updatedPortal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const schedule = resolveInterestChannelRefreshConfig(updatedPortal.settings);
  return NextResponse.json({
    success: true,
    portal_id: updatedPortal.id,
    schedule: {
      cadence: schedule.cadence,
      hour_utc: schedule.hourUtc,
    },
  });
}
