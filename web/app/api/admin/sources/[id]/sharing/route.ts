import { isAdmin, canManagePortal } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { upsertSharingRule, refreshPortalSourceAccess } from "@/lib/federation";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

// GET /api/admin/sources/[id]/sharing - Get source sharing rules
export async function GET(request: NextRequest, { params }: Props) {
  const { id } = await params;
  const sourceId = parseInt(id, 10);

  if (isNaN(sourceId)) {
    return NextResponse.json({ error: "Invalid source ID" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // First get basic source info without federation fields
  const { data: basicSource, error: basicError } = await supabase
    .from("sources")
    .select("id, name, slug, url, source_type, is_active")
    .eq("id", sourceId)
    .single();

  if (basicError || !basicSource) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  // Check admin access (for non-federation mode, require admin)
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Try to get federation data - this may fail if migration hasn't been applied
  let ownerPortalId: string | null = null;
  let ownerPortal: { id: string; slug: string; name: string } | null = null;
  let sharingRule = null;
  let subscriberCount = 0;
  let subscribers: unknown[] = [];

  try {
    // Try to get owner info using raw query to check if column exists
    const { data: sourceWithOwner, error: ownerError } = await supabase
      .from("sources")
      .select(`
        owner_portal_id,
        owner_portal:portals!sources_owner_portal_id_fkey(id, slug, name)
      `)
      .eq("id", sourceId)
      .single();

    if (!ownerError && sourceWithOwner) {
      const ownerData = sourceWithOwner as {
        owner_portal_id: string | null;
        owner_portal: { id: string; slug: string; name: string } | null;
      };
      ownerPortalId = ownerData.owner_portal_id;
      ownerPortal = ownerData.owner_portal;
    }

    // Try to get sharing rules
    const { data: sharingData } = await supabase
      .from("source_sharing_rules")
      .select("*")
      .eq("source_id", sourceId)
      .single();
    sharingRule = sharingData || null;

    // Try to get subscriber count
    const { count } = await supabase
      .from("source_subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("source_id", sourceId)
      .eq("is_active", true);
    subscriberCount = count || 0;

    // Try to get subscribers
    const { data: subsData } = await supabase
      .from("source_subscriptions")
      .select(`
        id,
        subscription_scope,
        subscribed_categories,
        created_at,
        subscriber:portals!source_subscriptions_subscriber_portal_id_fkey(id, slug, name)
      `)
      .eq("source_id", sourceId)
      .eq("is_active", true);
    subscribers = subsData || [];
  } catch {
    // Federation tables don't exist - that's okay, return basic data
    console.log("Federation tables not available - returning basic source data");
  }

  // Build the source object with whatever data we have
  const srcData = basicSource as {
    id: number;
    name: string;
    slug?: string;
    url?: string;
    source_type?: string;
    is_active: boolean;
  };
  const source = {
    id: srcData.id,
    name: srcData.name,
    slug: srcData.slug || "",
    url: srcData.url || "",
    source_type: srcData.source_type || "unknown",
    is_active: srcData.is_active,
    owner_portal_id: ownerPortalId,
    owner_portal: ownerPortal,
  };

  return NextResponse.json({
    source,
    sharingRule,
    subscriberCount,
    subscribers,
  });
}

// PUT /api/admin/sources/[id]/sharing - Create or update sharing rules
export async function PUT(request: NextRequest, { params }: Props) {
  const { id } = await params;
  const sourceId = parseInt(id, 10);

  if (isNaN(sourceId)) {
    return NextResponse.json({ error: "Invalid source ID" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Get source to verify ownership
  const { data: sourceData2, error: sourceError2 } = await supabase
    .from("sources")
    .select("id, owner_portal_id")
    .eq("id", sourceId)
    .single();

  const source2 = sourceData2 as {
    id: number;
    owner_portal_id: string | null;
  } | null;

  if (sourceError2 || !source2) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  // Only source owner or admin can manage sharing
  if (source2.owner_portal_id) {
    if (!(await canManagePortal(source2.owner_portal_id)) && !(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  } else if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!source2.owner_portal_id) {
    return NextResponse.json(
      { error: "Global sources cannot have sharing rules. Assign an owner first." },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { share_scope, allowed_categories } = body;

  // Validate share_scope
  if (!["all", "selected", "none"].includes(share_scope)) {
    return NextResponse.json({ error: "Invalid share_scope" }, { status: 400 });
  }

  // Validate allowed_categories when scope is 'selected'
  if (share_scope === "selected") {
    if (!Array.isArray(allowed_categories) || allowed_categories.length === 0) {
      return NextResponse.json(
        { error: "allowed_categories required when scope is 'selected'" },
        { status: 400 }
      );
    }
  }

  const result = await upsertSharingRule(
    sourceId,
    source2.owner_portal_id,
    share_scope,
    share_scope === "selected" ? allowed_categories : null
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Refresh the materialized view
  await refreshPortalSourceAccess();

  return NextResponse.json({ success: true });
}
