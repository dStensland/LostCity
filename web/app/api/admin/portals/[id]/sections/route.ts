import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

// Check if user is admin (simplified - extend as needed)
async function isAdmin(request: NextRequest): Promise<boolean> {
  const supabase = await createClient();
  void request; // Use request if needed for additional auth checks

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // Check if user is portal member with admin/owner role
  // For now, any authenticated user can manage portals they have access to
  return true;
}

// GET /api/admin/portals/[id]/sections - List sections for a portal
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: portalId } = await params;

  if (!(await isAdmin(request))) {
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sections });
}

// POST /api/admin/portals/[id]/sections - Create a new section
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: portalId } = await params;

  if (!(await isAdmin(request))) {
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
    .single();

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
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ section }, { status: 201 });
}
