import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { getLocalDateString } from "@/lib/formats";
import { logger } from "@/lib/logger";

type Organization = {
  id: string;
  name: string;
  slug: string;
  org_type: string;
  website: string | null;
  instagram: string | null;
  logo_url: string | null;
  description: string | null;
  categories: string[] | null;
  neighborhood: string | null;
  featured: boolean;
};

type OrganizationPortalSchema = {
  public: {
    Tables: {
      organization_portals: {
        Row: {
          organization_id: string;
        };
      };
    };
  };
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Rate limit: read endpoint
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const { searchParams } = new URL(request.url);
    const portalIdParam = searchParams.get("portal_id");
    const portalSlug = searchParams.get("portal_slug");
    const limitParam = searchParams.get("limit");

    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 0, 0), 200) : null;

    let portalId = portalIdParam || null;
    if (!portalId && portalSlug) {
      const { data: portalData } = await supabase
        .from("portals")
        .select("id")
        .eq("slug", portalSlug)
        .maybeSingle();
      portalId = (portalData as { id: string } | null)?.id || null;
    }

    // Get current date for event counting
    const today = getLocalDateString();

    // Resolve organizations by portal membership if requested
    let portalOrgIds: string[] | null = null;
    if (portalId) {
      const portalClient = supabase as unknown as SupabaseClient<OrganizationPortalSchema>;
      const { data: memberships, error: membershipError } = await portalClient
        .from("organization_portals")
        .select("organization_id")
        .eq("portal_id", portalId);

      if (membershipError) {
        logger.warn("organization_portals lookup failed, falling back to organizations.portal_id", { error: membershipError.message });
      } else {
        portalOrgIds = (memberships || []).map(
          (row: { organization_id: string }) => row.organization_id
        );
      }
    }

    // Fetch organizations
    let orgQuery = supabase
      .from("organizations")
      .select("id, name, slug, org_type, website, instagram, logo_url, description, categories, neighborhood, featured")
      .eq("hidden", false)
      .order("featured", { ascending: false })
      .order("name");

    if (portalId) {
      if (portalOrgIds) {
        if (portalOrgIds.length === 0) {
          return NextResponse.json(
            { organizations: [] },
            {
              headers: {
                "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
              },
            }
          );
        }
        orgQuery = orgQuery.in("id", portalOrgIds);
      } else {
        orgQuery = orgQuery.eq("portal_id", portalId);
      }
    }

    if (limit) {
      orgQuery = orgQuery.limit(limit);
    }

    const { data: organizations, error } = await orgQuery;

    if (error) {
      logger.error("Error fetching organizations", error);
      return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
    }

    // Get event counts for each organization
    let eventsQuery = supabase
      .from("events")
      .select("organization_id")
      .gte("start_date", today)
      .not("organization_id", "is", null);

    if (portalId) {
      eventsQuery = eventsQuery.eq("portal_id", portalId);
    }

    const { data: events } = await eventsQuery;

    const eventCounts: Record<string, number> = {};
    for (const event of (events || []) as { organization_id: string }[]) {
      eventCounts[event.organization_id] = (eventCounts[event.organization_id] || 0) + 1;
    }

    // Add event counts to organizations
    const organizationsWithCounts = ((organizations || []) as Organization[]).map((o) => ({
      ...o,
      event_count: eventCounts[o.id] || 0,
    }));

    const organizationIds = organizationsWithCounts.map((org) => org.id);
    const followerCounts = new Map<string, number>();
    const recommendationCounts = new Map<string, number>();

    if (organizationIds.length > 0) {
      const [{ data: followsData }, { data: recData }, { data: legacyRecData }] = await Promise.all([
        supabase
          .from("follows")
          .select("followed_organization_id")
          .in("followed_organization_id", organizationIds)
          .not("followed_organization_id", "is", null),
        supabase
          .from("recommendations")
          .select("organization_id")
          .in("organization_id", organizationIds)
          .eq("visibility", "public"),
        supabase
          .from("recommendations")
          .select("org_id")
          .in("org_id", organizationIds)
          .eq("visibility", "public"),
      ]);

      for (const row of (followsData || []) as { followed_organization_id: string | null }[]) {
        if (row.followed_organization_id) {
          followerCounts.set(
            row.followed_organization_id,
            (followerCounts.get(row.followed_organization_id) || 0) + 1
          );
        }
      }

      for (const row of (recData || []) as { organization_id: string | null }[]) {
        if (row.organization_id) {
          recommendationCounts.set(
            row.organization_id,
            (recommendationCounts.get(row.organization_id) || 0) + 1
          );
        }
      }

      for (const row of (legacyRecData || []) as { org_id: string | null }[]) {
        if (row.org_id) {
          recommendationCounts.set(
            row.org_id,
            (recommendationCounts.get(row.org_id) || 0) + 1
          );
        }
      }
    }

    const organizationsWithSocial = organizationsWithCounts.map((org) => ({
      ...org,
      follower_count: followerCounts.get(org.id) || 0,
      recommendation_count: recommendationCounts.get(org.id) || 0,
    }));

    return NextResponse.json(
      { organizations: organizationsWithSocial },
      {
        headers: {
          // Organizations rarely change - cache for 5 minutes
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    logger.error("Error in organizations API", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
