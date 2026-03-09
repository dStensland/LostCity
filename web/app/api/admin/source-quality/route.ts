import { isAdmin } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { errorApiResponse, parseIntParam } from "@/lib/api-utils";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const log = createLogger("admin/source-quality");

// ─── Types ────────────────────────────────────────────────────────────────────

type SourceQualityRow = {
  source_id: number;
  source_name: string;
  source_slug: string;
  is_active: boolean;
  total_events: number;
  held_events: number;
  held_pct: number | null;
  avg_quality: number | null;
  missing_description: number;
  missing_image: number;
};

type SourceQualitySummary = {
  total_sources: number;
  sources_with_alerts: number;
  total_held: number;
  total_events: number;
};

type SourceQualityResponse = {
  sources: SourceQualityRow[];
  alerts: SourceQualityRow[];
  summary: SourceQualitySummary;
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_ALERT_THRESHOLD = 30; // % held events that triggers an alert
const DEFAULT_MIN_EVENTS = 3;       // sources with fewer events are excluded
const MAX_ALERT_THRESHOLD = 100;
const MAX_MIN_EVENTS = 1000;

/**
 * GET /api/admin/source-quality
 *
 * Returns per-source feed quality metrics for upcoming events.
 * Requires admin authentication.
 *
 * Query params:
 * - alert_threshold: integer (default 30) — sources with held_pct >= this show in alerts
 * - min_events: integer (default 3) — exclude sources with fewer upcoming events
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Rate limit
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
    { logContext: "admin/source-quality" }
  );
  if (rateLimitResult) return rateLimitResult as NextResponse;

  try {
    // Auth check — must be a platform admin
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Parse and clamp query params
    const { searchParams } = new URL(request.url);

    const alertThreshold = Math.min(
      MAX_ALERT_THRESHOLD,
      Math.max(0, parseIntParam(searchParams.get("alert_threshold"), DEFAULT_ALERT_THRESHOLD) ?? DEFAULT_ALERT_THRESHOLD)
    );

    const minEvents = Math.min(
      MAX_MIN_EVENTS,
      Math.max(1, parseIntParam(searchParams.get("min_events"), DEFAULT_MIN_EVENTS) ?? DEFAULT_MIN_EVENTS)
    );

    // Call the RPC function via service client (bypasses RLS, admin-only context)
    const serviceClient = createServiceClient();

    const { data, error } = await serviceClient.rpc(
      "get_source_quality_metrics" as never,
      {
        p_min_events: minEvents,
        p_start_date: new Date().toISOString().slice(0, 10),
      } as never
    );

    if (error) {
      log.error("RPC get_source_quality_metrics failed", error, { minEvents, alertThreshold });
      return errorApiResponse("Failed to fetch source quality metrics", 500);
    }

    // Cast — Supabase can't infer RPC return types without generated types
    const rows = (data ?? []) as SourceQualityRow[];

    // Normalise numeric fields: Supabase returns NUMERIC as strings from RPCs
    const sources: SourceQualityRow[] = rows.map((r) => ({
      source_id: Number(r.source_id),
      source_name: r.source_name,
      source_slug: r.source_slug,
      is_active: r.is_active,
      total_events: Number(r.total_events),
      held_events: Number(r.held_events),
      held_pct: r.held_pct !== null ? Number(r.held_pct) : null,
      avg_quality: r.avg_quality !== null ? Number(r.avg_quality) : null,
      missing_description: Number(r.missing_description),
      missing_image: Number(r.missing_image),
    }));

    // Derive alert list — sources at or above the threshold
    const alerts = sources.filter(
      (s) => s.held_pct !== null && s.held_pct >= alertThreshold
    );

    // Summary stats
    const summary: SourceQualitySummary = {
      total_sources: sources.length,
      sources_with_alerts: alerts.length,
      total_held: sources.reduce((acc, s) => acc + s.held_events, 0),
      total_events: sources.reduce((acc, s) => acc + s.total_events, 0),
    };

    const response: SourceQualityResponse = { sources, alerts, summary };

    return NextResponse.json(response, {
      headers: {
        // Admin dashboards: short cache, still useful for repeat loads
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    log.error("Unhandled error in GET /api/admin/source-quality", error);
    return errorApiResponse("Internal server error", 500);
  }
}
