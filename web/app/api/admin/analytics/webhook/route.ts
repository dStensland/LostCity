import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { getLocalDateString } from "@/lib/formats";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type ApiKey = {
  id: string;
  key_hash: string;
  portal_id: string | null;
  scopes: string[];
  is_active: boolean;
  expires_at: string | null;
};

type DailyMetric = {
  id: string;
  date: string;
  portal_id: string;
  event_views: number;
  event_rsvps: number;
  event_saves: number;
  event_shares: number;
  new_signups: number;
  active_users: number;
  events_total: number;
  events_created: number;
  sources_active: number;
  crawl_runs: number;
  crawl_success_rate: number;
  created_at: string;
};

// Validate API key from Authorization header
async function validateApiKey(request: NextRequest): Promise<{ valid: boolean; portalId: string | null; error?: string }> {
  const serviceClient = createServiceClient();
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return { valid: false, portalId: null, error: "Missing Authorization header" };
  }

  if (!authHeader.startsWith("Bearer ")) {
    return { valid: false, portalId: null, error: "Invalid Authorization format. Use: Bearer <api_key>" };
  }

  const apiKey = authHeader.substring(7); // Remove "Bearer "

  if (!apiKey.startsWith("lc_")) {
    return { valid: false, portalId: null, error: "Invalid API key format" };
  }

  // Hash the key to compare with stored hash
  const keyHash = createHash("sha256").update(apiKey).digest("hex");

  // Look up the key using service client
  const { data: keyRecord, error } = await serviceClient
    .from("api_keys")
    .select("id, key_hash, portal_id, scopes, is_active, expires_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !keyRecord) {
    return { valid: false, portalId: null, error: "Invalid API key" };
  }

  const key = keyRecord as ApiKey;

  if (!key.is_active) {
    return { valid: false, portalId: null, error: "API key is inactive" };
  }

  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return { valid: false, portalId: null, error: "API key has expired" };
  }

  if (!key.scopes.includes("analytics:read")) {
    return { valid: false, portalId: null, error: "API key lacks analytics:read scope" };
  }

  // Use timing-safe comparison
  const computedHash = keyHash;
  const storedHash = key.key_hash;

  const isValid = timingSafeEqual(
    Buffer.from(computedHash),
    Buffer.from(storedHash)
  );

  if (!isValid) {
    return { valid: false, portalId: null, error: "Invalid API key" };
  }

  // Update last_used_at
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (serviceClient as any)
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id);

  return { valid: true, portalId: key.portal_id };
}

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.standard, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const supabase = createServiceClient();

  // Validate API key
  const auth = await validateApiKey(request);

  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  // Parse query params
  const searchParams = request.nextUrl.searchParams;
  const startDateParam = searchParams.get("start_date");
  const endDateParam = searchParams.get("end_date");
  const portalIdParam = searchParams.get("portal_id");

  // Default to last 30 days
  const endDate = endDateParam || getLocalDateString();
  const startDate = startDateParam || (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return getLocalDateString(d);
  })();

  // Determine portal scope
  // If API key has portal_id, restrict to that portal
  // If portalIdParam is provided and key allows it, use that
  let portalFilter: string | null = null;

  if (auth.portalId) {
    // Key is scoped to a portal - ignore any portal_id param
    portalFilter = auth.portalId;
  } else if (portalIdParam) {
    // Super admin key with portal filter
    portalFilter = portalIdParam;
  }

  // Build query
  let query = supabase
    .from("analytics_daily_portal")
    .select("date, portal_id, event_views, event_rsvps, event_saves, event_shares, new_signups, active_users, events_total, events_created, sources_active, crawl_runs, crawl_success_rate")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  if (portalFilter) {
    query = query.eq("portal_id", portalFilter);
  }

  const { data: analyticsData, error } = await query;

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json(
        { error: "Analytics tables not initialized" },
        { status: 503 }
      );
    }
    return NextResponse.json({
      error: "Failed to fetch analytics data",
    }, { status: 500 });
  }

  const metrics = (analyticsData || []) as DailyMetric[];

  // Get portal names for enrichment
  const portalIds = [...new Set(metrics.map(m => m.portal_id))];
  const { data: portals } = portalIds.length > 0
    ? await supabase
        .from("portals")
        .select("id, name, slug")
        .in("id", portalIds)
    : { data: [] };

  const portalMap = new Map<string, { name: string; slug: string }>();
  for (const p of (portals || []) as { id: string; name: string; slug: string }[]) {
    portalMap.set(p.id, { name: p.name, slug: p.slug });
  }

  // Enrich data with portal info
  const enrichedData = metrics.map(m => ({
    date: m.date,
    portal_id: m.portal_id,
    portal_name: portalMap.get(m.portal_id)?.name || null,
    portal_slug: portalMap.get(m.portal_id)?.slug || null,
    event_views: m.event_views,
    event_rsvps: m.event_rsvps,
    event_saves: m.event_saves,
    event_shares: m.event_shares,
    new_signups: m.new_signups,
    active_users: m.active_users,
    events_total: m.events_total,
    events_created: m.events_created,
    sources_active: m.sources_active,
    crawl_runs: m.crawl_runs,
    crawl_success_rate: m.crawl_success_rate,
  }));

  return NextResponse.json({
    schema: getSchema(),
    meta: {
      period: { start: startDate, end: endDate },
      record_count: enrichedData.length,
      generated_at: new Date().toISOString(),
      portal_scope: portalFilter,
    },
    data: enrichedData,
  });
}

function getSchema() {
  return {
    table: "analytics_daily_portal",
    columns: [
      { name: "date", type: "date", description: "The date for this metric row" },
      { name: "portal_id", type: "uuid", description: "Portal unique identifier" },
      { name: "portal_name", type: "string", description: "Portal display name" },
      { name: "portal_slug", type: "string", description: "Portal URL slug" },
      { name: "event_views", type: "integer", description: "Number of event page views" },
      { name: "event_rsvps", type: "integer", description: "Number of RSVPs (going/interested)" },
      { name: "event_saves", type: "integer", description: "Number of events saved/bookmarked" },
      { name: "event_shares", type: "integer", description: "Number of event shares" },
      { name: "new_signups", type: "integer", description: "New user registrations" },
      { name: "active_users", type: "integer", description: "Users with activity on this date" },
      { name: "events_total", type: "integer", description: "Total upcoming events" },
      { name: "events_created", type: "integer", description: "Events created on this date" },
      { name: "sources_active", type: "integer", description: "Number of active event sources" },
      { name: "crawl_runs", type: "integer", description: "Number of crawler runs" },
      { name: "crawl_success_rate", type: "decimal", description: "Percentage of successful crawls (0-100)" },
    ],
  };
}
