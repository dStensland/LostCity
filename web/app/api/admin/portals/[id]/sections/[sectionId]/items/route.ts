import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { canManagePortal } from "@/lib/supabase/server";
import { adminErrorResponse, checkBodySize, checkParsedBodySize } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";

async function sectionBelongsToPortal(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  sectionId: string,
  portalId: string
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("portal_sections")
    .select("id")
    .eq("id", sectionId)
    .eq("portal_id", portalId)
    .maybeSingle();

  return !error && !!data;
}

// POST /api/admin/portals/[id]/sections/[sectionId]/items - Add item to section
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId, sectionId } = await params;

  if (!(await canManagePortal(portalId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const parsedSizeCheck = checkParsedBodySize(body);
  if (parsedSizeCheck) return parsedSizeCheck;

  const { entity_type, entity_id, note } = body;

  if (!entity_type || !entity_id) {
    return NextResponse.json(
      { error: "entity_type and entity_id are required" },
      { status: 400 }
    );
  }

  const validEntityIdType = typeof entity_id === "string" || typeof entity_id === "number";
  if (typeof entity_type !== "string" || !validEntityIdType) {
    return NextResponse.json(
      { error: "entity_type must be a string and entity_id must be a string or number" },
      { status: 400 }
    );
  }

  if (note !== undefined && (typeof note !== "string" || note.length > 1000)) {
    return NextResponse.json(
      { error: "note must be a string up to 1000 characters" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const isSectionOwned = await sectionBelongsToPortal(supabase, sectionId, portalId);
  if (!isSectionOwned) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  // Get max display_order for this section
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: maxOrder } = await (supabase as any)
    .from("portal_section_items")
    .select("display_order")
    .eq("section_id", sectionId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const display_order = ((maxOrder as { display_order: number } | null)?.display_order || 0) + 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item, error } = await (supabase as any)
    .from("portal_section_items")
    .insert({
      section_id: sectionId,
      entity_type,
      entity_id,
      note,
      display_order,
    })
    .select()
    .maybeSingle();

  if (error) {
    return adminErrorResponse(error, "POST /api/admin/portals/[id]/sections/[sectionId]/items");
  }

  return NextResponse.json({ item }, { status: 201 });
}

// DELETE /api/admin/portals/[id]/sections/[sectionId]/items - Remove item from section
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId, sectionId } = await params;

  if (!(await canManagePortal(portalId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");

  if (!itemId) {
    return NextResponse.json({ error: "itemId is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const isSectionOwned = await sectionBelongsToPortal(supabase, sectionId, portalId);
  if (!isSectionOwned) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: deletedItem, error } = await (supabase as any)
    .from("portal_section_items")
    .delete()
    .eq("id", itemId)
    .eq("section_id", sectionId)
    .select("id")
    .maybeSingle();

  if (error) {
    return adminErrorResponse(error, "POST /api/admin/portals/[id]/sections/[sectionId]/items");
  }

  if (!deletedItem) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

// PATCH /api/admin/portals/[id]/sections/[sectionId]/items - Reorder items
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId, sectionId } = await params;

  if (!(await canManagePortal(portalId))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const parsedSizeCheck = checkParsedBodySize(body);
  if (parsedSizeCheck) return parsedSizeCheck;

  const { items } = body; // Array of { id, display_order }

  if (!items || !Array.isArray(items)) {
    return NextResponse.json({ error: "items array is required" }, { status: 400 });
  }

  if (items.length > 500) {
    return NextResponse.json({ error: "items array too large" }, { status: 400 });
  }

  for (const item of items) {
    const hasValidId = typeof item?.id === "string" || typeof item?.id === "number";
    const hasValidOrder = Number.isInteger(item?.display_order) && item.display_order >= 0;
    if (!hasValidId || !hasValidOrder) {
      return NextResponse.json(
        { error: "Each item requires id and non-negative integer display_order" },
        { status: 400 }
      );
    }
  }

  const supabase = createServiceClient();
  const isSectionOwned = await sectionBelongsToPortal(supabase, sectionId, portalId);
  if (!isSectionOwned) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  // Update each item's display_order
  for (const item of items) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updatedItem, error } = await (supabase as any)
      .from("portal_section_items")
      .update({ display_order: item.display_order })
      .eq("id", item.id)
      .eq("section_id", sectionId)
      .select("id")
      .maybeSingle();

    if (error) {
      return adminErrorResponse(error, "POST /api/admin/portals/[id]/sections/[sectionId]/items");
    }

    if (!updatedItem) {
      return NextResponse.json({ error: `Item ${item.id} not found` }, { status: 404 });
    }
  }

  return NextResponse.json({ success: true });
}
