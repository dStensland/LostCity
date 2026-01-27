import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

async function isAdmin(request: NextRequest): Promise<boolean> {
  const supabase = await createClient();
  void request;

  const { data: { user } } = await supabase.auth.getUser();
  return !!user;
}

// GET /api/admin/portals/[id]/sections/[sectionId] - Get section with items
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const { sectionId } = await params;

  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: section, error } = await (supabase as any)
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
    .eq("id", sectionId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ section });
}

// PATCH /api/admin/portals/[id]/sections/[sectionId] - Update section
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const { sectionId } = await params;

  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, description, section_type, auto_filter, is_visible, display_order } = body;

  const supabase = createServiceClient();

  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (section_type !== undefined) updates.section_type = section_type;
  if (auto_filter !== undefined) updates.auto_filter = auto_filter;
  if (is_visible !== undefined) updates.is_visible = is_visible;
  if (display_order !== undefined) updates.display_order = display_order;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: section, error } = await (supabase as any)
    .from("portal_sections")
    .update(updates)
    .eq("id", sectionId)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ section });
}

// DELETE /api/admin/portals/[id]/sections/[sectionId] - Delete section
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const { sectionId } = await params;

  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("portal_sections")
    .delete()
    .eq("id", sectionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
