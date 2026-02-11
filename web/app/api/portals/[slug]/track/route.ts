import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { checkBodySize, sanitizeString, isValidEnum } from "@/lib/api-utils";

const VALID_PAGE_TYPES = ["feed", "find", "event", "spot", "series", "community"] as const;

// POST /api/portals/[slug]/track - Track a page view (anonymous, fire-and-forget)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Rate limit - standard (100/min) for tracking
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.standard, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  // Check body size
  const sizeCheck = checkBodySize(request, 2048);
  if (sizeCheck) return sizeCheck;

  const { slug } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const pageType = body.page_type as string;
  if (!isValidEnum(pageType, VALID_PAGE_TYPES)) {
    return new Response(null, { status: 400 });
  }

  const rawEntityId = body.entity_id;
  const entityId = typeof rawEntityId === "number" && Number.isInteger(rawEntityId) && rawEntityId > 0
    ? rawEntityId
    : null;

  // Look up portal
  const supabase = createServiceClient();
  const { data: portal } = await supabase
    .from("portals")
    .select("id")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!portal) {
    return new Response(null, { status: 404 });
  }

  const portalData = portal as { id: string };

  // Validate entity attribution for event tracking so cross-portal IDs cannot be injected.
  if (pageType === "event") {
    if (!entityId) {
      return new Response(null, { status: 400 });
    }

    const { data: event } = await supabase
      .from("events")
      .select("id")
      .eq("id", entityId)
      .eq("portal_id", portalData.id)
      .maybeSingle();

    if (!event) {
      return new Response(null, { status: 400 });
    }
  }

  if (pageType === "spot" && entityId) {
    const { data: venue } = await supabase
      .from("venues")
      .select("id")
      .eq("id", entityId)
      .maybeSingle();

    if (!venue) {
      return new Response(null, { status: 400 });
    }
  }

  // Insert page view
  await supabase.from("portal_page_views").insert({
    portal_id: portalData.id,
    page_type: pageType,
    entity_id: entityId,
    referrer: typeof body.referrer === "string" ? sanitizeString(body.referrer).slice(0, 500) : null,
    utm_source: typeof body.utm_source === "string" ? sanitizeString(body.utm_source).slice(0, 100) : null,
    utm_medium: typeof body.utm_medium === "string" ? sanitizeString(body.utm_medium).slice(0, 100) : null,
    utm_campaign: typeof body.utm_campaign === "string" ? sanitizeString(body.utm_campaign).slice(0, 100) : null,
    user_agent: request.headers.get("user-agent")?.slice(0, 500) || null,
  } as never);

  return new Response(null, { status: 204 });
}
