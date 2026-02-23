import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { canManagePortal } from "@/lib/supabase/server";
import { adminErrorResponse, checkBodySize, checkParsedBodySize } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

type Props = { params: Promise<{ id: string; headerId: string }> };

// GET /api/admin/portals/[id]/feed-headers/[headerId]
export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId, headerId } = await params;

  if (!(await canManagePortal(portalId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: header, error } = await (supabase as any)
    .from("portal_feed_headers")
    .select("*")
    .eq("id", headerId)
    .eq("portal_id", portalId)
    .maybeSingle();

  if (error) {
    return adminErrorResponse(error, "GET /api/admin/portals/[id]/feed-headers/[headerId]");
  }
  if (!header) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ header });
}

// PATCH /api/admin/portals/[id]/feed-headers/[headerId]
export async function PATCH(request: NextRequest, { params }: Props) {
  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId, headerId } = await params;

  if (!(await canManagePortal(portalId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const parsedSizeCheck = checkParsedBodySize(body);
  if (parsedSizeCheck) return parsedSizeCheck;

  // Validate constraints
  if (typeof body.priority === "number" && body.priority < 1) {
    return NextResponse.json({ error: "priority must be a positive integer" }, { status: 400 });
  }
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

  // Build update payload — only include fields that were provided
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const allowedFields = [
    "name", "slug", "is_active", "priority",
    "schedule_start", "schedule_end", "show_on_days",
    "show_after_time", "show_before_time", "conditions",
    "headline", "subtitle", "hero_image_url", "accent_color",
    "layout_variant", "text_treatment",
    "dashboard_cards", "quick_links", "cta",
    "suppressed_event_ids", "boosted_event_ids",
  ];
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: header, error } = await (supabase as any)
    .from("portal_feed_headers")
    .update(updates)
    .eq("id", headerId)
    .eq("portal_id", portalId)
    .select()
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "slug must be unique per portal" }, { status: 409 });
    }
    return adminErrorResponse(error, "PATCH /api/admin/portals/[id]/feed-headers/[headerId]");
  }
  if (!header) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ header });
}

// DELETE /api/admin/portals/[id]/feed-headers/[headerId]
export async function DELETE(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId, headerId } = await params;

  if (!(await canManagePortal(portalId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("portal_feed_headers")
    .delete()
    .eq("id", headerId)
    .eq("portal_id", portalId);

  if (error) {
    return adminErrorResponse(error, "DELETE /api/admin/portals/[id]/feed-headers/[headerId]");
  }

  return NextResponse.json({ success: true });
}
