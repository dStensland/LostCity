import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type PortalRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  portal_type: string;
  status: string;
  visibility: string;
  filters: Record<string, unknown>;
  branding: Record<string, unknown>;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

// GET /api/admin/portals - List all portals with stats
export async function GET() {
  const supabase = await createClient();

  // Get all portals with member count
  const { data: portalsData, error } = await supabase
    .from("portals")
    .select(`
      id,
      slug,
      name,
      tagline,
      portal_type,
      status,
      visibility,
      filters,
      branding,
      settings,
      created_at,
      updated_at
    `)
    .order("portal_type", { ascending: true })
    .order("name", { ascending: true });

  const portals = (portalsData || []) as PortalRow[];

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get member counts per portal
  const { data: memberCounts } = await supabase
    .from("portal_members")
    .select("portal_id");

  const memberCountMap: Record<string, number> = {};
  (memberCounts || []).forEach((m: { portal_id: string }) => {
    memberCountMap[m.portal_id] = (memberCountMap[m.portal_id] || 0) + 1;
  });

  // Get content counts per portal
  const { data: contentCounts } = await supabase
    .from("portal_content")
    .select("portal_id");

  const contentCountMap: Record<string, number> = {};
  (contentCounts || []).forEach((c: { portal_id: string }) => {
    contentCountMap[c.portal_id] = (contentCountMap[c.portal_id] || 0) + 1;
  });

  // Enrich portals with counts
  const enrichedPortals = portals.map((p) => ({
    ...p,
    member_count: memberCountMap[p.id] || 0,
    content_count: contentCountMap[p.id] || 0,
  }));

  // Summary stats
  const summary = {
    total: enrichedPortals.length,
    by_type: {
      city: enrichedPortals.filter((p) => p.portal_type === "city").length,
      event: enrichedPortals.filter((p) => p.portal_type === "event").length,
      business: enrichedPortals.filter((p) => p.portal_type === "business").length,
      personal: enrichedPortals.filter((p) => p.portal_type === "personal").length,
    },
    by_status: {
      active: enrichedPortals.filter((p) => p.status === "active").length,
      draft: enrichedPortals.filter((p) => p.status === "draft").length,
      archived: enrichedPortals.filter((p) => p.status === "archived").length,
    },
  };

  return NextResponse.json({ portals: enrichedPortals, summary });
}

// POST /api/admin/portals - Create a new portal
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { slug, name, tagline, portal_type, visibility = "public", filters = {}, branding = {}, settings = {} } = body;

  if (!slug || !name || !portal_type) {
    return NextResponse.json({ error: "slug, name, and portal_type are required" }, { status: 400 });
  }

  // Validate portal_type
  if (!["city", "event", "business", "personal"].includes(portal_type)) {
    return NextResponse.json({ error: "Invalid portal_type" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("portals")
    .insert({
      slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      name,
      tagline: tagline || null,
      portal_type,
      status: "draft",
      visibility,
      filters,
      branding,
      settings,
      owner_type: "user",
      owner_id: user.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Portal slug already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Add creator as owner member
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("portal_members").insert({
    portal_id: data.id,
    user_id: user.id,
    role: "owner",
  });

  return NextResponse.json({ portal: data }, { status: 201 });
}
