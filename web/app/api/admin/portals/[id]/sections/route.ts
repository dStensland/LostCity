import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { canManagePortal } from "@/lib/supabase/server";
import { adminErrorResponse } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";

// GET /api/admin/portals/[id]/sections - List sections for a portal
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId } = await params;

  if (!(await canManagePortal(portalId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sections, error } = await (supabase as any)
    .from("portal_sections")
    .select(`
      *,
      items:portal_section_items(
        id,
        entity_type,
        entity_id,
        display_order,
        note
      )
    `)
    .eq("portal_id", portalId)
    .order("display_order", { ascending: true });

  if (error) {
    return adminErrorResponse(error, "GET /api/admin/portals/[id]/sections");
  }

  return NextResponse.json({ sections });
}

// POST /api/admin/portals/[id]/sections - Create a new section
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId } = await params;

  if (!(await canManagePortal(portalId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, slug, description, section_type, auto_filter, is_visible } = body;

  if (!title || !slug || !section_type) {
    return NextResponse.json(
      { error: "title, slug, and section_type are required" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // Get max display_order for this portal
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: maxOrder } = await (supabase as any)
    .from("portal_sections")
    .select("display_order")
    .eq("portal_id", portalId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const display_order = ((maxOrder as { display_order: number } | null)?.display_order || 0) + 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: section, error } = await (supabase as any)
    .from("portal_sections")
    .insert({
      portal_id: portalId,
      title,
      slug,
      description,
      section_type,
      auto_filter,
      is_visible: is_visible ?? true,
      display_order,
    })
    .select()
    .maybeSingle();

  if (error) {
    return adminErrorResponse(error, "GET /api/admin/portals/[id]/sections");
  }

  return NextResponse.json({ section }, { status: 201 });
}
