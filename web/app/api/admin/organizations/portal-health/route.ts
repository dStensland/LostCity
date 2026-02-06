import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

// Lazy initialization to avoid build errors when env vars not present
let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error("Missing Supabase configuration for admin operations");
    }

    _supabaseAdmin = createClient(url, key);
  }
  return _supabaseAdmin;
}

type OrganizationRow = {
  id: string;
  name: string;
  portal_id: string | null;
};

type OrganizationPortalRow = {
  organization_id: string;
  portal_id: string;
};

type OrganizationPortalSchema = {
  public: {
    Tables: {
      organization_portals: {
        Row: OrganizationPortalRow;
      };
    };
  };
};

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.standard, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const portalClient = supabase as SupabaseClient<OrganizationPortalSchema>;
    const [{ data: organizations, error: orgError }, { data: memberships, error: membershipError }] =
      await Promise.all([
        supabase.from("organizations").select("id, name, portal_id").eq("hidden", false),
        portalClient.from("organization_portals").select("organization_id, portal_id"),
      ]);

    if (orgError) {
      return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
    }

    if (membershipError) {
      return NextResponse.json({ error: "Failed to fetch organization portal memberships" }, { status: 500 });
    }

    const orgRows = (organizations || []) as OrganizationRow[];
    const membershipRows = (memberships || []) as OrganizationPortalRow[];

    const membershipMap = new Map<string, Set<string>>();
    for (const row of membershipRows) {
      if (!membershipMap.has(row.organization_id)) {
        membershipMap.set(row.organization_id, new Set());
      }
      membershipMap.get(row.organization_id)?.add(row.portal_id);
    }

    const missingPortalId = orgRows.filter((org) => !org.portal_id);
    const missingMembership = orgRows.filter(
      (org) => org.portal_id && !membershipMap.get(org.id)?.has(org.portal_id)
    );
    const membershipWithoutPortalId = orgRows.filter(
      (org) => !org.portal_id && membershipMap.has(org.id)
    );
    const multiPortalOrgs = orgRows
      .filter((org) => (membershipMap.get(org.id)?.size || 0) > 1)
      .map((org) => ({
        id: org.id,
        name: org.name,
        portal_ids: Array.from(membershipMap.get(org.id) || []),
      }));

    return NextResponse.json({
      totals: {
        organizations: orgRows.length,
        with_portal_id: orgRows.length - missingPortalId.length,
        missing_portal_id: missingPortalId.length,
        missing_memberships: missingMembership.length,
        memberships_without_portal_id: membershipWithoutPortalId.length,
        multi_portal_orgs: multiPortalOrgs.length,
      },
      missing_portal_id: missingPortalId,
      missing_membership: missingMembership,
      memberships_without_portal_id: membershipWithoutPortalId,
      multi_portal_orgs: multiPortalOrgs,
    });
  } catch (err) {
    logger.error("Error checking organization portal health:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
