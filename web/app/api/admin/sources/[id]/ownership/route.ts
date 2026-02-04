import { isAdmin } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { updateSourceOwnership, refreshPortalSourceAccess } from "@/lib/federation";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

// GET /api/admin/sources/[id]/ownership - Get source ownership info
export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.standard, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id } = await params;
  const sourceId = parseInt(id, 10);

  if (isNaN(sourceId)) {
    return NextResponse.json({ error: "Invalid source ID" }, { status: 400 });
  }

  // Verify admin
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supabase = createServiceClient();

  const { data: source, error } = await supabase
    .from("sources")
    .select(`
      id,
      name,
      slug,
      owner_portal_id,
      owner_portal:portals!sources_owner_portal_id_fkey(id, slug, name)
    `)
    .eq("id", sourceId)
    .maybeSingle();

  if (error || !source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  return NextResponse.json({ source });
}

// PATCH /api/admin/sources/[id]/ownership - Change source ownership
export async function PATCH(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.standard, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id } = await params;
  const sourceId = parseInt(id, 10);

  if (isNaN(sourceId)) {
    return NextResponse.json({ error: "Invalid source ID" }, { status: 400 });
  }

  // Verify admin
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { owner_portal_id } = body;

  // Validate owner_portal_id (can be null to make source global)
  if (owner_portal_id !== null && typeof owner_portal_id !== "string") {
    return NextResponse.json({ error: "Invalid owner_portal_id" }, { status: 400 });
  }

  // Verify the portal exists if not null
  if (owner_portal_id !== null) {
    const supabase = createServiceClient();
    const { data: portal } = await supabase
      .from("portals")
      .select("id")
      .eq("id", owner_portal_id)
      .maybeSingle();

    if (!portal) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }
  }

  const result = await updateSourceOwnership(sourceId, owner_portal_id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Refresh the materialized view
  await refreshPortalSourceAccess();

  return NextResponse.json({ success: true });
}
