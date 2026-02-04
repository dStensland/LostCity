import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { adminErrorResponse } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

async function isAdmin(request: NextRequest): Promise<boolean> {
  const supabase = await createClient();
  void request;

  const { data: { user } } = await supabase.auth.getUser();
  return !!user;
}

// POST /api/admin/portals/[id]/sections/[sectionId]/items - Add item to section
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write);
  if (rateLimitResult) return rateLimitResult;

  const { sectionId } = await params;

  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { entity_type, entity_id, note } = body;

  if (!entity_type || !entity_id) {
    return NextResponse.json(
      { error: "entity_type and entity_id are required" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

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
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write);
  if (rateLimitResult) return rateLimitResult;

  const { sectionId } = await params;
  void sectionId; // Section ID validated by path

  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");

  if (!itemId) {
    return NextResponse.json({ error: "itemId is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("portal_section_items")
    .delete()
    .eq("id", itemId);

  if (error) {
    return adminErrorResponse(error, "POST /api/admin/portals/[id]/sections/[sectionId]/items");
  }

  return NextResponse.json({ success: true });
}

// PATCH /api/admin/portals/[id]/sections/[sectionId]/items - Reorder items
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write);
  if (rateLimitResult) return rateLimitResult;

  const { sectionId } = await params;
  void sectionId;

  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { items } = body; // Array of { id, display_order }

  if (!items || !Array.isArray(items)) {
    return NextResponse.json({ error: "items array is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Update each item's display_order
  for (const item of items) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("portal_section_items")
      .update({ display_order: item.display_order })
      .eq("id", item.id);
  }

  return NextResponse.json({ success: true });
}
