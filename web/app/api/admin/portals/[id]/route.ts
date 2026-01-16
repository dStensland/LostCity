import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

type PortalData = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  portal_type: string;
  owner_type: string | null;
  owner_id: string | null;
  status: string;
  visibility: string;
  filters: Record<string, unknown>;
  branding: Record<string, unknown>;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

// GET /api/admin/portals/[id] - Get portal details
export async function GET(request: NextRequest, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: portalData, error } = await supabase
    .from("portals")
    .select(`
      id,
      slug,
      name,
      tagline,
      portal_type,
      owner_type,
      owner_id,
      status,
      visibility,
      filters,
      branding,
      settings,
      created_at,
      updated_at
    `)
    .eq("id", id)
    .single();

  const portal = portalData as PortalData | null;

  if (error || !portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  // Get members
  const { data: members } = await supabase
    .from("portal_members")
    .select(`
      id,
      role,
      created_at,
      user:profiles(id, username, display_name, avatar_url)
    `)
    .eq("portal_id", id);

  // Get content count
  const { count: contentCount } = await supabase
    .from("portal_content")
    .select("id", { count: "exact", head: true })
    .eq("portal_id", id);

  // Get section count
  const { count: sectionCount } = await supabase
    .from("portal_sections")
    .select("id", { count: "exact", head: true })
    .eq("portal_id", id);

  return NextResponse.json({
    portal: {
      ...portal,
      members: members || [],
      member_count: (members || []).length,
      content_count: contentCount || 0,
      section_count: sectionCount || 0,
    },
  });
}

// PATCH /api/admin/portals/[id] - Update portal
export async function PATCH(request: NextRequest, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const allowedFields = ["name", "tagline", "status", "visibility", "filters", "branding", "settings"];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("portals")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ portal: data });
}

// DELETE /api/admin/portals/[id] - Delete portal
export async function DELETE(request: NextRequest, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if portal exists
  const { data: portalData } = await supabase
    .from("portals")
    .select("id, slug")
    .eq("id", id)
    .single();

  const portal = portalData as { id: string; slug: string } | null;

  if (!portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  // Don't allow deleting the main atlanta portal
  if (portal.slug === "atlanta") {
    return NextResponse.json({ error: "Cannot delete the main city portal" }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("portals")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
