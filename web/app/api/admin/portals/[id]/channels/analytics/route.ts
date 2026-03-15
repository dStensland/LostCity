import { NextRequest, NextResponse } from "next/server";
import { canManagePortal } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  adminErrorResponse,
  isValidUUID,
  parseIntParam,
  type AnySupabase,
} from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { ENABLE_INTEREST_CHANNELS_V1 } from "@/lib/launch-flags";
import { getLocalDateString } from "@/lib/formats";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

type PortalRow = {
  id: string;
  slug: string;
  name: string;
};

type InteractionRow = {
  action_type: string;
  section_key: string | null;
  target_kind: string | null;
  target_id: string | null;
  target_label: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type TopChannelSummary = {
  channel_id: string;
  channel_slug: string | null;
  channel_name: string;
  joins: number;
  leaves: number;
  net: number;
};

type ChannelTypeFunnelSummary = {
  channel_type: string;
  total_channels: number;
  channels_engaged: number;
  joins: number;
  leaves: number;
  net_joins: number;
  join_share: number;
  join_rate_per_page_view: number | null;
};

type SurfaceSummary = {
  surface: string;
  joins: number;
  leaves: number;
  filters: number;
};

function apiDisabledResponse() {
  return NextResponse.json(
    { error: "Interest Channels API is disabled." },
    { status: 404 },
  );
}

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

function getMetadataString(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getDayBucket(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10);
}

// GET /api/admin/portals/[id]/channels/analytics
export async function GET(request: NextRequest, { params }: Props) {
  if (!ENABLE_INTEREST_CHANNELS_V1) return apiDisabledResponse();

  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId } = await params;
  const access = await requirePortalAccess(
    portalId,
    "GET /api/admin/portals/[id]/channels/analytics (portal)",
  );
  if (access.response) return access.response;
  const { db, portal } = access;

  const days = Math.min(Math.max(parseIntParam(request.nextUrl.searchParams.get("days")) ?? 30, 1), 365);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = getLocalDateString(startDate);
  const endDateStr = getLocalDateString();
  const startTimestamp = `${startDateStr}T00:00:00`;
  const endTimestamp = `${endDateStr}T23:59:59.999`;

  const interactionRows: InteractionRow[] = [];
  const pageSize = 5000;
  let offset = 0;

  while (true) {
    const { data, error } = await db
      .from("portal_interaction_events")
      .select("action_type, section_key, target_kind, target_id, target_label, metadata, created_at")
      .eq("portal_id", portal.id)
      .eq("action_type", "resource_clicked")
      .in("section_key", ["interest_channels_feed", "interest_channels_groups"])
      .gte("created_at", startTimestamp)
      .lte("created_at", endTimestamp)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      return adminErrorResponse(error, "GET /api/admin/portals/[id]/channels/analytics (events)");
    }

    const pageRows = (data || []) as InteractionRow[];
    interactionRows.push(...pageRows);

    if (pageRows.length < pageSize) break;
    offset += pageSize;
  }

  const { data: channelRows, error: channelError } = await db
    .from("interest_channels")
    .select("id, slug, name, channel_type")
    .eq("portal_id", portal.id);

  if (channelError) {
    return adminErrorResponse(channelError, "GET /api/admin/portals/[id]/channels/analytics (channels)");
  }

  const channelMetaById = new Map<string, { slug: string | null; name: string; channel_type: string }>();
  const channelCountByType = new Map<string, number>();
  for (const row of (channelRows || []) as Array<{
    id: string;
    slug: string;
    name: string;
    channel_type: string;
  }>) {
    channelMetaById.set(row.id, {
      slug: row.slug,
      name: row.name,
      channel_type: row.channel_type,
    });
    channelCountByType.set(row.channel_type, (channelCountByType.get(row.channel_type) || 0) + 1);
  }

  let pageViews = 0;
  let joins = 0;
  let leaves = 0;
  let filters = 0;

  const channelStats = new Map<string, { joins: number; leaves: number; label: string | null }>();
  const daily = new Map<string, { joins: number; leaves: number; filters: number }>();
  const surfaceStats = new Map<string, SurfaceSummary>();
  const filterStats = new Map<string, number>();
  const typeStats = new Map<string, {
    joins: number;
    leaves: number;
    channels_engaged: Set<string>;
  }>();

  for (const row of interactionRows) {
    const targetKind = row.target_kind || "";
    const bucket = getDayBucket(row.created_at);
    const dayStat = daily.get(bucket) || { joins: 0, leaves: 0, filters: 0 };
    const surface = getMetadataString(row.metadata, "surface") || "unknown";
    const surfaceStat = surfaceStats.get(surface) || { surface, joins: 0, leaves: 0, filters: 0 };

    if (targetKind === "interest_channel_page") {
      pageViews += 1;
    } else if (targetKind === "interest_channel_join" || targetKind === "interest_channel_leave") {
      const isJoin = targetKind === "interest_channel_join";
      if (isJoin) {
        joins += 1;
        dayStat.joins += 1;
        surfaceStat.joins += 1;
      } else {
        leaves += 1;
        dayStat.leaves += 1;
        surfaceStat.leaves += 1;
      }

      if (row.target_id) {
        const current = channelStats.get(row.target_id) || {
          joins: 0,
          leaves: 0,
          label: row.target_label,
        };
        if (isJoin) current.joins += 1;
        else current.leaves += 1;
        channelStats.set(row.target_id, current);

        const channelType = channelMetaById.get(row.target_id)?.channel_type || "unknown";
        const typeCurrent = typeStats.get(channelType) || {
          joins: 0,
          leaves: 0,
          channels_engaged: new Set<string>(),
        };
        if (isJoin) typeCurrent.joins += 1;
        else typeCurrent.leaves += 1;
        typeCurrent.channels_engaged.add(row.target_id);
        typeStats.set(channelType, typeCurrent);
      }
    } else if (targetKind === "interest_channel_filter") {
      filters += 1;
      dayStat.filters += 1;
      surfaceStat.filters += 1;

      const filterType = getMetadataString(row.metadata, "filter_type") || "unknown";
      const filterValue = getMetadataString(row.metadata, "filter_value") || "unknown";
      const filterKey = `${filterType}:${filterValue}`;
      filterStats.set(filterKey, (filterStats.get(filterKey) || 0) + 1);
    }

    daily.set(bucket, dayStat);
    surfaceStats.set(surface, surfaceStat);
  }

  const topChannels: TopChannelSummary[] = Array.from(channelStats.entries())
    .map(([channelId, stat]) => {
      const channelMeta = channelMetaById.get(channelId);
      const channelName = channelMeta?.name || stat.label || "Unknown channel";
      return {
        channel_id: channelId,
        channel_slug: channelMeta?.slug || null,
        channel_name: channelName,
        joins: stat.joins,
        leaves: stat.leaves,
        net: stat.joins - stat.leaves,
      };
    })
    .sort((a, b) => b.joins - a.joins || b.net - a.net || a.channel_name.localeCompare(b.channel_name))
    .slice(0, 10);

  const topFilters = Array.from(filterStats.entries())
    .map(([key, count]) => {
      const [filterType, ...rest] = key.split(":");
      return {
        filter_type: filterType,
        filter_value: rest.join(":"),
        count,
      };
    })
    .sort((a, b) => b.count - a.count || a.filter_type.localeCompare(b.filter_type))
    .slice(0, 10);

  const dailySeries = Array.from(daily.entries())
    .map(([date, stat]) => ({
      date,
      joins: stat.joins,
      leaves: stat.leaves,
      filters: stat.filters,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const surfaceBreakdown = Array.from(surfaceStats.values())
    .sort((a, b) => (b.joins + b.filters) - (a.joins + a.filters));

  const channelTypeFunnel: ChannelTypeFunnelSummary[] = Array.from(
    new Set<string>([
      ...channelCountByType.keys(),
      ...typeStats.keys(),
    ]),
  )
    .map((channelType) => {
      const stats = typeStats.get(channelType) || {
        joins: 0,
        leaves: 0,
        channels_engaged: new Set<string>(),
      };
      const typeJoins = stats.joins;
      const typeLeaves = stats.leaves;
      return {
        channel_type: channelType,
        total_channels: channelCountByType.get(channelType) || 0,
        channels_engaged: stats.channels_engaged.size,
        joins: typeJoins,
        leaves: typeLeaves,
        net_joins: typeJoins - typeLeaves,
        join_share: joins > 0 ? Number((typeJoins / joins).toFixed(3)) : 0,
        join_rate_per_page_view: pageViews > 0
          ? Number((typeJoins / pageViews).toFixed(3))
          : null,
      };
    })
    .sort((a, b) => b.joins - a.joins || b.net_joins - a.net_joins || a.channel_type.localeCompare(b.channel_type));

  const opportunities: string[] = [];
  if (pageViews > 0 && joins === 0) {
    opportunities.push("Groups page has views but zero joins. Improve CTA clarity or default presets.");
  }
  if (leaves > joins) {
    opportunities.push("Leaves exceed joins in this window. Review channel relevance and match precision.");
  }
  for (const row of channelTypeFunnel) {
    if (row.total_channels > 0 && row.joins === 0) {
      opportunities.push(
        `${row.channel_type} has ${row.total_channels} channel(s) but no joins. Revisit naming and onboarding copy.`,
      );
    } else if (row.joins > 0 && row.net_joins <= 0) {
      opportunities.push(
        `${row.channel_type} is attracting joins but net growth is non-positive. Investigate churn drivers.`,
      );
    }
  }

  return NextResponse.json({
    portal: {
      id: portal.id,
      slug: portal.slug,
      name: portal.name,
    },
    period: {
      start: startDateStr,
      end: endDateStr,
      days,
    },
    summary: {
      group_page_views: pageViews,
      total_joins: joins,
      total_leaves: leaves,
      net_joins: joins - leaves,
      join_rate_per_page_view: pageViews > 0 ? Number((joins / pageViews).toFixed(3)) : null,
      filter_interactions: filters,
      unique_channels_engaged: channelStats.size,
    },
    top_channels: topChannels,
    top_filters: topFilters,
    surface_breakdown: surfaceBreakdown,
    channel_type_funnel: channelTypeFunnel,
    opportunities,
    daily: dailySeries,
  });
}
