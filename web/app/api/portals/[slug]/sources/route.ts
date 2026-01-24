import { NextRequest, NextResponse } from "next/server";
import { getPortalSourceAccess } from "@/lib/federation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

// GET /api/portals/[slug]/sources - Get accessible sources for a portal
export async function GET(request: NextRequest, { params }: Props) {
  const { slug } = await params;

  // Get portal by slug
  const { data: portalData, error: portalError } = await supabase
    .from("portals")
    .select("id, slug, name")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  const portal = portalData as {
    id: string;
    slug: string;
    name: string;
  } | null;

  if (portalError || !portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  // Get accessible sources for this portal
  const sourceAccess = await getPortalSourceAccess(portal.id);

  return NextResponse.json({
    portal: {
      id: portal.id,
      slug: portal.slug,
      name: portal.name,
    },
    sources: sourceAccess.accessDetails,
    sourceCount: sourceAccess.sourceIds.length,
  });
}
