import { createClient, canManagePortal } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_PORTAL_SLUG } from "@/lib/constants";
import { isCustomDomainAvailable, generateDomainVerificationToken } from "@/lib/portal";
import { invalidateDomainCache } from "@/lib/domain-cache";
import { filterBrandingForPlan, canUseCustomDomain } from "@/lib/plan-features";
import { errorResponse } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";

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
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id } = await params;

  // Verify admin or portal owner
  if (!(await canManagePortal(id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supabase = await createClient();

  // Use type assertion since we have new columns not in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: portalData, error } = await (supabase as any)
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
      plan,
      custom_domain,
      custom_domain_verified,
      custom_domain_verification_token,
      parent_portal_id,
      created_at,
      updated_at
    `)
    .eq("id", id)
    .maybeSingle();

  const portal = portalData as (PortalData & {
    plan?: string;
    custom_domain?: string | null;
    custom_domain_verified?: boolean;
    custom_domain_verification_token?: string | null;
    parent_portal_id?: string | null;
  }) | null;

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
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id } = await params;

  // Verify admin or portal owner
  if (!(await canManagePortal(id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supabase = await createClient();

  const body = await request.json();

  // Extended allowed fields to include new B2B columns
  const allowedFields = [
    "name", "tagline", "status", "visibility", "filters", "branding", "settings",
    "custom_domain", "plan", "parent_portal_id"
  ];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  // Get current portal data for custom domain comparison and plan enforcement
  const { data: currentPortal } = await supabase
    .from("portals")
    .select("custom_domain, plan")
    .eq("id", id)
    .maybeSingle() as { data: { custom_domain: string | null; plan: string } | null };

  // Determine the effective plan (new plan if being updated, else current)
  const effectivePlan = (updates.plan as string) || currentPortal?.plan || "starter";

  // Filter branding fields based on plan tier
  // This prevents lower-tier plans from setting enterprise-only features
  if (updates.branding !== undefined) {
    updates.branding = filterBrandingForPlan(updates.branding as Record<string, unknown>, effectivePlan);
  }

  // Handle custom_domain updates
  if (updates.custom_domain !== undefined) {
    const newDomain = updates.custom_domain as string | null;

    // Check plan allows custom domains (professional or enterprise)
    if (!canUseCustomDomain(effectivePlan) && newDomain) {
      return NextResponse.json(
        { error: "Custom domains require Professional or Enterprise plan" },
        { status: 403 }
      );
    }

    if (newDomain) {
      // Normalize the domain
      const normalizedDomain = newDomain.toLowerCase().replace(/^www\./, "");
      updates.custom_domain = normalizedDomain;

      // Check if domain is available
      const isAvailable = await isCustomDomainAvailable(normalizedDomain, id);
      if (!isAvailable) {
        return NextResponse.json(
          { error: "This custom domain is already in use" },
          { status: 409 }
        );
      }

      // If domain is changing, reset verification and generate new token
      if (normalizedDomain !== currentPortal?.custom_domain) {
        updates.custom_domain_verified = false;
        updates.custom_domain_verification_token = generateDomainVerificationToken();
      }
    } else {
      // Domain is being removed
      updates.custom_domain_verified = false;
      updates.custom_domain_verification_token = null;
    }

    // Invalidate old domain from cache
    if (currentPortal?.custom_domain) {
      invalidateDomainCache(currentPortal.custom_domain);
    }
  }

  // Validate plan field and handle downgrades
  if (updates.plan !== undefined) {
    const validPlans = ["starter", "professional", "enterprise"];
    if (!validPlans.includes(updates.plan as string)) {
      return NextResponse.json(
        { error: "Invalid plan. Must be: starter, professional, or enterprise" },
        { status: 400 }
      );
    }

    // Handle plan downgrade: clear features not available in new plan
    const newPlan = updates.plan as string;
    const oldPlan = currentPortal?.plan || "starter";

    // If downgrading to starter, must clear custom domain
    if (newPlan === "starter" && oldPlan !== "starter" && currentPortal?.custom_domain) {
      updates.custom_domain = null;
      updates.custom_domain_verified = false;
      updates.custom_domain_verification_token = null;
      // Invalidate the old domain from cache
      invalidateDomainCache(currentPortal.custom_domain);
    }
  }

  updates.updated_at = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("portals")
    .update(updates)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    return errorResponse(error, "PATCH /api/admin/portals/[id]");
  }

  // Return verification instructions if custom domain was set
  const response: Record<string, unknown> = { portal: data };
  if (updates.custom_domain && !data.custom_domain_verified) {
    response.domainVerification = {
      domain: data.custom_domain,
      txtRecord: `_lostcity-verify.${data.custom_domain}`,
      txtValue: `portal-id=${data.custom_domain_verification_token}`,
      instructions: "Add a TXT record to your DNS to verify domain ownership",
    };
  }

  return NextResponse.json(response);
}

// DELETE /api/admin/portals/[id] - Delete portal
export async function DELETE(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id } = await params;

  // Verify admin or portal owner
  if (!(await canManagePortal(id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supabase = await createClient();

  // Check if portal exists
  const { data: portalData } = await supabase
    .from("portals")
    .select("id, slug")
    .eq("id", id)
    .maybeSingle();

  const portal = portalData as { id: string; slug: string } | null;

  if (!portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  // Don't allow deleting the main city portal
  if (portal.slug === DEFAULT_PORTAL_SLUG) {
    return NextResponse.json({ error: "Cannot delete the main city portal" }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("portals")
    .delete()
    .eq("id", id);

  if (error) {
    return errorResponse(error, "PATCH /api/admin/portals/[id]");
  }

  return NextResponse.json({ success: true });
}
