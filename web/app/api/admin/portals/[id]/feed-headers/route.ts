import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { canManagePortal } from "@/lib/supabase/server";
import { adminErrorResponse, checkBodySize, checkParsedBodySize } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

type Props = { params: Promise<{ id: string }> };

// GET /api/admin/portals/[id]/feed-headers
export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId } = await params;

  if (!(await canManagePortal(portalId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: headers, error } = await (supabase as any)
    .from("portal_feed_headers")
    .select("*")
    .eq("portal_id", portalId)
    .order("priority", { ascending: true });

  if (error) {
    return adminErrorResponse(error, "GET /api/admin/portals/[id]/feed-headers");
  }

  return NextResponse.json({ headers });
}

// POST /api/admin/portals/[id]/feed-headers
export async function POST(request: NextRequest, { params }: Props) {
  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId } = await params;

  if (!(await canManagePortal(portalId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const parsedSizeCheck = checkParsedBodySize(body);
  if (parsedSizeCheck) return parsedSizeCheck;

  const { name, slug } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
  }
  if (typeof name !== "string" || typeof slug !== "string") {
    return NextResponse.json({ error: "name and slug must be strings" }, { status: 400 });
  }

  // Validate constraints
  const priority = typeof body.priority === "number" && body.priority > 0 ? body.priority : 100;
  if (Array.isArray(body.dashboard_cards) && body.dashboard_cards.length > 6) {
    return NextResponse.json({ error: "dashboard_cards max is 6" }, { status: 400 });
  }
  if (Array.isArray(body.quick_links) && body.quick_links.length > 8) {
    return NextResponse.json({ error: "quick_links max is 8" }, { status: 400 });
  }
  if (Array.isArray(body.suppressed_event_ids) && body.suppressed_event_ids.length > 50) {
    return NextResponse.json({ error: "suppressed_event_ids max is 50" }, { status: 400 });
  }
  if (Array.isArray(body.boosted_event_ids) && body.boosted_event_ids.length > 20) {
    return NextResponse.json({ error: "boosted_event_ids max is 20" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: header, error } = await (supabase as any)
    .from("portal_feed_headers")
    .insert({
      portal_id: portalId,
      name,
      slug,
      is_active: body.is_active ?? true,
      priority,
      schedule_start: body.schedule_start ?? null,
      schedule_end: body.schedule_end ?? null,
      show_on_days: body.show_on_days ?? null,
      show_after_time: body.show_after_time ?? null,
      show_before_time: body.show_before_time ?? null,
      conditions: body.conditions ?? {},
      headline: body.headline ?? null,
      subtitle: body.subtitle ?? null,
      hero_image_url: body.hero_image_url ?? null,
      accent_color: body.accent_color ?? null,
      layout_variant: body.layout_variant ?? null,
      text_treatment: body.text_treatment ?? null,
      dashboard_cards: body.dashboard_cards ?? null,
      quick_links: body.quick_links ?? null,
      cta: body.cta ?? null,
      suppressed_event_ids: body.suppressed_event_ids ?? null,
      boosted_event_ids: body.boosted_event_ids ?? null,
    })
    .select()
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "slug must be unique per portal" }, { status: 409 });
    }
    return adminErrorResponse(error, "POST /api/admin/portals/[id]/feed-headers");
  }

  return NextResponse.json({ header }, { status: 201 });
}
