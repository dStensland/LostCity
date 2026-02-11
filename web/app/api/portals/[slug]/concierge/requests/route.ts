import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { checkBodySize, isValidEnum } from "@/lib/api-utils";

const VALID_REQUEST_TYPES = ["spa-reset", "dining-hold", "house-car", "late-checkout"] as const;
const VALID_GUEST_INTENTS = ["business", "romance", "night_out", "wellness"] as const;

type RouteContext = {
  params: Promise<{ slug: string }>;
};

type ConciergeRequestBody = {
  request_type?: string;
  guest_intent?: string;
  itinerary_ids?: string[];
  source?: string;
};

function createRequestId(): string {
  const base = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().split("-")[0]
    : Math.random().toString(36).slice(2, 10);
  return `CR-${Date.now().toString(36).toUpperCase()}-${base.toUpperCase()}`;
}

// POST /api/portals/[slug]/concierge/requests - Queue a concierge service request
export async function POST(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const sizeCheck = checkBodySize(request, 4096);
  if (sizeCheck) return sizeCheck;

  const { slug } = await context.params;

  let body: ConciergeRequestBody;
  try {
    body = (await request.json()) as ConciergeRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidEnum(body.request_type, VALID_REQUEST_TYPES)) {
    return NextResponse.json({ error: "Invalid request_type" }, { status: 400 });
  }

  if (!isValidEnum(body.guest_intent, VALID_GUEST_INTENTS)) {
    return NextResponse.json({ error: "Invalid guest_intent" }, { status: 400 });
  }

  const itineraryIds = Array.isArray(body.itinerary_ids)
    ? body.itinerary_ids.filter((value) => typeof value === "string").slice(0, 12)
    : [];

  const source = typeof body.source === "string" ? body.source.slice(0, 80) : "portal";

  const supabase = await createClient();
  const { data: portal } = await supabase
    .from("portals")
    .select("id, slug")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  const portalData = portal as { id: string; slug: string } | null;

  if (!portalData) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const requestId = createRequestId();

  return NextResponse.json(
    {
      request_id: requestId,
      status: "queued",
      portal_slug: portalData.slug,
      request_type: body.request_type,
      guest_intent: body.guest_intent,
      itinerary_ids: itineraryIds,
      source,
      submitted_at: new Date().toISOString(),
      note: "Queued in concierge intake (pitch mode).",
    },
    { status: 202 }
  );
}
