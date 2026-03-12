import { NextRequest, NextResponse } from "next/server";
import { canManagePortal } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  adminErrorResponse,
  isValidUUID,
  type AnySupabase,
} from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

type PortalRow = {
  id: string;
  slug: string;
  name: string;
};

type OpportunityRow = {
  id: string;
  slug: string;
  title: string;
  commitment_level: string;
  updated_at: string;
  source_id: number | null;
  portal_id: string | null;
  organization: {
    name: string;
    slug: string;
  };
  source: {
    name: string;
    slug: string;
  } | null;
};

type OpportunityJoinShape = {
  id: string;
  slug: string;
  title: string;
  commitment_level: string;
  updated_at: string;
  source_id: number | null;
  portal_id: string | null;
  organization:
    | {
        name: string;
        slug: string;
      }
    | Array<{
        name: string;
        slug: string;
      }>
    | null;
  source:
    | {
        name: string;
        slug: string;
      }
    | Array<{
        name: string;
        slug: string;
      }>
    | null;
};

type InteractionRow = {
  target_id: string | null;
  target_kind: string | null;
};

type OpportunityQualityStatus = "healthy" | "stale" | "low_conversion" | "no_interest";

async function requirePortalAccess(portalId: string, context: string) {
  if (!isValidUUID(portalId)) {
    return { response: NextResponse.json({ error: "Invalid portal id" }, { status: 400 }) };
  }

  if (!(await canManagePortal(portalId))) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const db = createServiceClient() as unknown as AnySupabase;
  const { data: portalData, error: portalError } = await db
    .from("portals")
    .select("id, slug, name")
    .eq("id", portalId)
    .maybeSingle();

  if (portalError) {
    return { response: adminErrorResponse(portalError, context), db };
  }

  const portal = (portalData as PortalRow | null) || null;
  if (!portal) {
    return { response: NextResponse.json({ error: "Portal not found" }, { status: 404 }), db };
  }

  return { db, portal };
}

function diffDays(fromIso: string, to = new Date()): number {
  const from = new Date(fromIso);
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function firstJoinRow<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// GET /api/admin/portals/[id]/volunteer/quality
export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId } = await params;
  const access = await requirePortalAccess(
    portalId,
    "GET /api/admin/portals/[id]/volunteer/quality (portal)",
  );
  if (access.response) return access.response;
  const { db, portal } = access;

  const staleDaysParam = Number.parseInt(request.nextUrl.searchParams.get("stale_days") || "21", 10);
  const staleDays = Math.min(Math.max(Number.isFinite(staleDaysParam) ? staleDaysParam : 21, 1), 180);

  const { data: sourceAccessRows, error: sourceAccessError } = await db
    .from("portal_source_access")
    .select("source_id")
    .eq("portal_id", portal.id);

  if (sourceAccessError) {
    return adminErrorResponse(sourceAccessError, "GET /api/admin/portals/[id]/volunteer/quality (source access)");
  }

  const accessibleSourceIds = new Set(
    ((sourceAccessRows || []) as Array<{ source_id: number | null }>)
      .map((row) => row.source_id)
      .filter((value): value is number => typeof value === "number"),
  );

  const { data: opportunityRows, error: opportunitiesError } = await db
    .from("volunteer_opportunities")
    .select(`
      id,
      slug,
      title,
      commitment_level,
      updated_at,
      source_id,
      portal_id,
      organization:organizations!inner(name, slug),
      source:sources(name, slug)
    `)
    .eq("is_active", true)
    .or(`portal_id.is.null,portal_id.eq.${portal.id}`);

  if (opportunitiesError) {
    return adminErrorResponse(opportunitiesError, "GET /api/admin/portals/[id]/volunteer/quality (opportunities)");
  }

  const volunteerRows = ((opportunityRows || []) as unknown as OpportunityJoinShape[])
    .map((opportunity): OpportunityRow | null => {
      const organization = firstJoinRow(opportunity.organization);
      if (!organization) return null;

      return {
        id: opportunity.id,
        slug: opportunity.slug,
        title: opportunity.title,
        commitment_level: opportunity.commitment_level,
        updated_at: opportunity.updated_at,
        source_id: opportunity.source_id,
        portal_id: opportunity.portal_id,
        organization,
        source: firstJoinRow(opportunity.source),
      };
    })
    .filter((opportunity): opportunity is OpportunityRow => Boolean(opportunity))
    .filter((opportunity) => {
    if (opportunity.source_id === null) return true;
    if (opportunity.portal_id === portal.id) return true;
    if (accessibleSourceIds.size === 0) return true;
    return accessibleSourceIds.has(opportunity.source_id);
  });

  const opportunityIds = volunteerRows.map((opportunity) => opportunity.id);

  const [{ data: engagementRows, error: engagementsError }, { data: interactionRows, error: interactionError }] =
    await Promise.all([
      opportunityIds.length > 0
        ? db
            .from("volunteer_engagements")
            .select("opportunity_id, status")
            .in("opportunity_id", opportunityIds)
        : Promise.resolve({ data: [], error: null }),
      opportunityIds.length > 0
        ? db
            .from("portal_interaction_events")
            .select("target_id, target_kind")
            .eq("portal_id", portal.id)
            .eq("action_type", "resource_clicked")
            .in("target_kind", ["volunteer_detail_view", "volunteer_interest", "volunteer_apply"])
            .in("target_id", opportunityIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (engagementsError) {
    return adminErrorResponse(engagementsError, "GET /api/admin/portals/[id]/volunteer/quality (engagements)");
  }
  if (interactionError) {
    return adminErrorResponse(interactionError, "GET /api/admin/portals/[id]/volunteer/quality (interactions)");
  }

  const engagementCounts = new Map<string, number>();
  const detailViewCounts = new Map<string, number>();
  const applyCounts = new Map<string, number>();
  const interestCounts = new Map<string, number>();

  for (const row of (engagementRows || []) as Array<{ opportunity_id: string; status: string }>) {
    engagementCounts.set(row.opportunity_id, (engagementCounts.get(row.opportunity_id) || 0) + 1);
  }

  for (const row of (interactionRows || []) as InteractionRow[]) {
    if (!row.target_id) continue;
    if (row.target_kind === "volunteer_detail_view") {
      detailViewCounts.set(row.target_id, (detailViewCounts.get(row.target_id) || 0) + 1);
    }
    if (row.target_kind === "volunteer_apply") {
      applyCounts.set(row.target_id, (applyCounts.get(row.target_id) || 0) + 1);
    }
    if (row.target_kind === "volunteer_interest") {
      interestCounts.set(row.target_id, (interestCounts.get(row.target_id) || 0) + 1);
    }
  }

  const rows = volunteerRows.map((opportunity) => {
    const ageDays = diffDays(opportunity.updated_at);
    const detailViews = detailViewCounts.get(opportunity.id) || 0;
    const tracked = engagementCounts.get(opportunity.id) || 0;
    const applyClicks = applyCounts.get(opportunity.id) || 0;
    const interestClicks = interestCounts.get(opportunity.id) || 0;

    let qualityStatus: OpportunityQualityStatus = "healthy";
    if (ageDays >= staleDays) {
      qualityStatus = "stale";
    } else if (interestClicks > 0 && applyClicks === 0) {
      qualityStatus = "low_conversion";
    } else if (interestClicks === 0 && tracked === 0 && applyClicks === 0) {
      qualityStatus = "no_interest";
    }

    const detailToInterestRate = detailViews > 0
      ? Number(((interestClicks / detailViews) * 100).toFixed(2))
      : null;
    const detailToApplyRate = detailViews > 0
      ? Number(((applyClicks / detailViews) * 100).toFixed(2))
      : null;
    const interestToApplyRate = interestClicks > 0
      ? Number(((applyClicks / interestClicks) * 100).toFixed(2))
      : null;

    return {
      id: opportunity.id,
      slug: opportunity.slug,
      title: opportunity.title,
      commitment_level: opportunity.commitment_level,
      organization_name: opportunity.organization.name,
      organization_slug: opportunity.organization.slug,
      source_slug: opportunity.source?.slug || null,
      source_name: opportunity.source?.name || null,
      updated_at: opportunity.updated_at,
      age_days: ageDays,
      detail_views: detailViews,
      tracked_count: tracked,
      interest_clicks: interestClicks,
      apply_clicks: applyClicks,
      detail_to_interest_rate: detailToInterestRate,
      detail_to_apply_rate: detailToApplyRate,
      interest_to_apply_rate: interestToApplyRate,
      quality_status: qualityStatus,
    };
  });

  const staleCount = rows.filter((row) => row.quality_status === "stale").length;
  const lowConversionCount = rows.filter((row) => row.quality_status === "low_conversion").length;
  const noInterestCount = rows.filter((row) => row.quality_status === "no_interest").length;

  const summaryOpportunities: string[] = [];
  if (staleCount > 0) {
    summaryOpportunities.push(`${staleCount} opportunity record(s) are older than ${staleDays} days.`);
  }
  if (lowConversionCount > 0) {
    summaryOpportunities.push(`${lowConversionCount} opportunity record(s) have interest activity but zero apply clicks.`);
  }
  if (noInterestCount > 0) {
    summaryOpportunities.push(`${noInterestCount} opportunity record(s) have no tracked interest or apply clicks yet.`);
  }

  const totalDetailViews = Array.from(detailViewCounts.values()).reduce((sum, count) => sum + count, 0);
  const totalInterestClicks = Array.from(interestCounts.values()).reduce((sum, count) => sum + count, 0);
  const totalApplyClicks = Array.from(applyCounts.values()).reduce((sum, count) => sum + count, 0);
  const detailToInterestRate = totalDetailViews > 0
    ? Number(((totalInterestClicks / totalDetailViews) * 100).toFixed(2))
    : null;
  const detailToApplyRate = totalDetailViews > 0
    ? Number(((totalApplyClicks / totalDetailViews) * 100).toFixed(2))
    : null;
  const interestToApplyRate = totalInterestClicks > 0
    ? Number(((totalApplyClicks / totalInterestClicks) * 100).toFixed(2))
    : null;

  return NextResponse.json({
    portal,
    summary: {
      total_opportunities: rows.length,
      stale_count: staleCount,
      low_conversion_count: lowConversionCount,
      no_interest_count: noInterestCount,
      tracked_engagements: Array.from(engagementCounts.values()).reduce((sum, count) => sum + count, 0),
      detail_views: totalDetailViews,
      interest_clicks: totalInterestClicks,
      apply_clicks: totalApplyClicks,
      detail_to_interest_rate: detailToInterestRate,
      detail_to_apply_rate: detailToApplyRate,
      interest_to_apply_rate: interestToApplyRate,
      opportunities: summaryOpportunities,
    },
    opportunities: rows.sort((a, b) => {
      const statusOrder = { stale: 0, low_conversion: 1, no_interest: 2, healthy: 3 };
      const statusDiff = statusOrder[a.quality_status] - statusOrder[b.quality_status];
      if (statusDiff !== 0) return statusDiff;
      return b.age_days - a.age_days;
    }),
  });
}
