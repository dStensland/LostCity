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
import { refreshEventChannelMatchesForPortal } from "@/lib/interest-channel-matches";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

function apiDisabledResponse() {
  return NextResponse.json(
    { error: "Interest Channels API is disabled." },
    { status: 404 },
  );
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE_REGEX.test(value);
}

async function requirePortalAccess(portalId: string, context: string) {
  if (!isValidUUID(portalId)) {
    return { response: NextResponse.json({ error: "Invalid portal id" }, { status: 400 }) };
  }
  if (!(await canManagePortal(portalId))) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const db = createServiceClient() as unknown as AnySupabase;
  const { data: portal, error } = await db
    .from("portals")
    .select("id, slug, name")
    .eq("id", portalId)
    .maybeSingle();

  if (error) {
    return { response: adminErrorResponse(error, context), db };
  }
  if (!portal) {
    return { response: NextResponse.json({ error: "Portal not found" }, { status: 404 }), db };
  }

  return { db, portal };
}

// GET /api/admin/portals/[id]/channels/refresh-matches
export async function GET(request: NextRequest, { params }: Props) {
  if (!ENABLE_INTEREST_CHANNELS_V1) return apiDisabledResponse();

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId } = await params;
  const access = await requirePortalAccess(
    portalId,
    "GET /api/admin/portals/[id]/channels/refresh-matches (portal)",
  );
  if (access.response) return access.response;
  const { db } = access;

  const [{ count, error: countError }, { data: latestData, error: latestError }] =
    await Promise.all([
      db
        .from("event_channel_matches")
        .select("event_id", { count: "exact", head: true })
        .eq("portal_id", portalId),
      db
        .from("event_channel_matches")
        .select("matched_at")
        .eq("portal_id", portalId)
        .order("matched_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (countError) {
    return adminErrorResponse(
      countError,
      "GET /api/admin/portals/[id]/channels/refresh-matches (count)",
    );
  }
  if (latestError) {
    return adminErrorResponse(
      latestError,
      "GET /api/admin/portals/[id]/channels/refresh-matches (latest)",
    );
  }

  const latest = latestData as { matched_at: string } | null;

  return NextResponse.json({
    portal_id: portalId,
    total_matches: count || 0,
    last_matched_at: latest?.matched_at || null,
  });
}

// POST /api/admin/portals/[id]/channels/refresh-matches
export async function POST(request: NextRequest, { params }: Props) {
  if (!ENABLE_INTEREST_CHANNELS_V1) return apiDisabledResponse();

  const sizeCheck = checkBodySize(request, 4096);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId } = await params;
  const access = await requirePortalAccess(
    portalId,
    "POST /api/admin/portals/[id]/channels/refresh-matches (portal)",
  );
  if (access.response) return access.response;
  const { db } = access;

  let body: { start_date?: string; end_date?: string; max_events?: number } = {};
  try {
    body = (await request.json()) as typeof body;
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
    const result = await refreshEventChannelMatchesForPortal(db, portalId, {
      startDate: body.start_date,
      endDate: body.end_date,
      maxEvents: body.max_events,
    });

    return NextResponse.json({
      success: true,
      refresh: result,
    });
  } catch (error) {
    return adminErrorResponse(
      error,
      "POST /api/admin/portals/[id]/channels/refresh-matches (refresh)",
    );
  }
}
