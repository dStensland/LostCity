import { createClient, isAdmin } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { createSubscription, refreshPortalSourceAccess } from "@/lib/federation";
import { hasFeature } from "@/lib/plan-features";
import { errorResponse } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

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
  plan?: string;
  custom_domain?: string | null;
  parent_portal_id?: string | null;
  created_at: string;
  updated_at: string;
};

// GET /api/admin/portals - List all portals with stats
export async function GET(request: NextRequest) {
  // Apply rate limiting (write tier - admin endpoint)
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  // Verify admin
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supabase = await createClient();

  // Get all portals with member count
  // Use type assertion since we have new columns not in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: portalsData, error } = await (supabase as any)
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
      plan,
      custom_domain,
      parent_portal_id,
      created_at,
      updated_at
    `)
    .order("portal_type", { ascending: true })
    .order("name", { ascending: true });

  const portals = (portalsData || []) as PortalRow[];

  if (error) {
    return errorResponse(error, "POST /api/admin/portals");
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
  // Apply rate limiting (write tier - admin endpoint)
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  // Verify admin
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supabase = await createClient();
  const serviceClient = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  // user is guaranteed non-null since isAdmin() passed
  const userId = user!.id;

  const body = await request.json();
  const {
    slug,
    name,
    tagline,
    portal_type,
    visibility = "public",
    filters = {},
    branding = {},
    settings = {},
    plan = "starter",
    parent_portal_id,
    auto_subscribe_parent = true, // Auto-subscribe to parent's shared sources
  } = body;

  if (!slug || !name || !portal_type) {
    return NextResponse.json({ error: "slug, name, and portal_type are required" }, { status: 400 });
  }

  // Validate portal_type
  if (!["city", "event", "business", "personal"].includes(portal_type)) {
    return NextResponse.json({ error: "Invalid portal_type" }, { status: 400 });
  }

  // Validate plan
  if (!["starter", "professional", "enterprise"].includes(plan)) {
    return NextResponse.json({ error: "Invalid plan. Must be: starter, professional, or enterprise" }, { status: 400 });
  }

  // Verify parent portal exists if provided
  if (parent_portal_id) {
    const { data: parentPortal } = await supabase
      .from("portals")
      .select("id, portal_type")
      .eq("id", parent_portal_id)
      .maybeSingle() as { data: { id: string; portal_type: string } | null };

    if (!parentPortal) {
      return NextResponse.json({ error: "Parent portal not found" }, { status: 400 });
    }

    // Parent should typically be a city portal
    if (parentPortal.portal_type !== "city") {
      console.warn(`Warning: Parent portal ${parent_portal_id} is not a city portal`);
    }
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
      plan,
      parent_portal_id: parent_portal_id || null,
      owner_type: "user",
      owner_id: userId,
    })
    .select()
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Portal slug already exists" }, { status: 409 });
    }
    return errorResponse(error, "POST /api/admin/portals");
  }

  // Add creator as owner member
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("portal_members").insert({
    portal_id: data.id,
    user_id: userId,
    role: "owner",
  });

  // Auto-subscribe to parent portal's shared sources (for B2B portals)
  let subscriptionResults: { sourceId: number; success: boolean; error?: string }[] = [];

  // Only auto-subscribe if the plan allows source subscriptions
  const canSubscribe = hasFeature(plan, "can_subscribe_sources");

  if (portal_type === "business" && parent_portal_id && auto_subscribe_parent && canSubscribe) {
    // Get sources shared by the parent portal
    // Uses type assertions since these are new tables
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sharedSources } = await (serviceClient as any)
      .from("source_sharing_rules")
      .select(`
        source_id,
        share_scope,
        allowed_categories,
        source:sources!source_sharing_rules_source_id_fkey(
          id,
          name,
          is_active,
          owner_portal_id
        )
      `)
      .eq("owner_portal_id", parent_portal_id)
      .neq("share_scope", "none");

    if (sharedSources && sharedSources.length > 0) {
      // Subscribe to each shared source
      subscriptionResults = await Promise.all(
        sharedSources
          .filter((s: { source: { is_active: boolean } | null }) => s.source?.is_active)
          .map(async (sharingRule: {
            source_id: number;
            share_scope: string;
            allowed_categories: string[] | null;
          }) => {
            // If source is shared with 'all', subscribe to all
            // If source is shared with 'selected', subscribe to only allowed categories
            const scope = sharingRule.share_scope === "all" ? "all" : "selected";
            const categories = sharingRule.share_scope === "selected"
              ? sharingRule.allowed_categories
              : null;

            const result = await createSubscription(
              data.id,
              sharingRule.source_id,
              scope as "all" | "selected",
              categories
            );

            return {
              sourceId: sharingRule.source_id,
              success: result.success,
              error: result.error,
            };
          })
      );

      // Refresh the materialized view so the portal can access subscribed sources
      await refreshPortalSourceAccess();
    }
  }

  // Build response
  const response: Record<string, unknown> = {
    portal: data,
  };

  // Include subscription results if any were created
  if (subscriptionResults.length > 0) {
    response.subscriptions = {
      created: subscriptionResults.filter(r => r.success).length,
      failed: subscriptionResults.filter(r => !r.success).length,
      details: subscriptionResults,
    };
  }

  return NextResponse.json(response, { status: 201 });
}
