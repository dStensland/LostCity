import { NextRequest, NextResponse } from "next/server";
import { getPortalSourceAccess } from "@/lib/federation";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

// GET /api/portals/[slug]/sources - Get accessible sources for a portal
export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();
  const { slug } = await params;

  // Get portal by slug
  const { data: portalData, error: portalError } = await supabase
    .from("portals")
    .select("id, slug, name")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

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
