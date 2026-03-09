import { NextRequest, NextResponse } from "next/server";
import { canManagePortal } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  adminErrorResponse,
  checkBodySize,
  checkParsedBodySize,
  isValidString,
  isValidUUID,
  type AnySupabase,
} from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { ENABLE_INTEREST_CHANNELS_V1 } from "@/lib/launch-flags";
import {
  isValidChannelSlug,
  isValidChannelType,
  isValidRulePayload,
  isValidRuleType,
} from "@/lib/interest-channels";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

type ChannelRow = {
  id: string;
  portal_id: string | null;
  slug: string;
  name: string;
  channel_type: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type RuleRow = {
  id: string;
  channel_id: string;
  rule_type: string;
  rule_payload: Record<string, unknown>;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ChannelQualityStatus = "healthy" | "no_rules" | "no_matches" | "subscriber_gap";

type RuleInput = {
  rule_type?: string;
  rule_payload?: Record<string, unknown>;
  priority?: number;
  is_active?: boolean;
};

function apiDisabledResponse() {
  return NextResponse.json(
    { error: "Interest Channels API is disabled." },
    { status: 404 },
  );
}

function withUniqueViolation(error: unknown, message: string): NextResponse | null {
  const code = typeof error === "object" && error && "code" in error
    ? String((error as { code?: unknown }).code)
    : null;
  if (code === "23505") {
    return NextResponse.json({ error: message }, { status: 409 });
  }
  return null;
}

function validateRuleInput(rule: RuleInput): string | null {
  if (!isValidRuleType(rule.rule_type)) return "Invalid rule_type";
  if (!isValidRulePayload(rule.rule_payload)) return "rule_payload must be an object";
  if (rule.priority !== undefined && !Number.isInteger(rule.priority)) {
    return "priority must be an integer";
  }
  if (rule.is_active !== undefined && typeof rule.is_active !== "boolean") {
    return "is_active must be a boolean";
  }
  return null;
}

async function requirePortalAccess(portalId: string, context: string) {
  if (!isValidUUID(portalId)) {
    return { response: NextResponse.json({ error: "Invalid portal id" }, { status: 400 }) };
  }

  if (!(await canManagePortal(portalId))) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const db = createServiceClient() as unknown as AnySupabase;
  const { data: portal, error } = await db
    .from("portals")
    .select("id, slug, name")
    .eq("id", portalId)
    .maybeSingle();

  if (error) {
    return { response: adminErrorResponse(error, context), db };
  }

  if (!portal) {
    return { response: NextResponse.json({ error: "Portal not found" }, { status: 404 }), db };
  }

  return { db, portal };
}

// GET /api/admin/portals/[id]/channels
export async function GET(request: NextRequest, { params }: Props) {
  if (!ENABLE_INTEREST_CHANNELS_V1) return apiDisabledResponse();

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId } = await params;
  const access = await requirePortalAccess(portalId, "GET /api/admin/portals/[id]/channels (portal)");
  if (access.response) return access.response;
  const { db, portal } = access;

  const { data: channelRows, error: channelsError } = await db
    .from("interest_channels")
    .select("id, portal_id, slug, name, channel_type, description, metadata, is_active, sort_order, created_at, updated_at")
    .eq("portal_id", portalId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (channelsError) {
    return adminErrorResponse(channelsError, "GET /api/admin/portals/[id]/channels (channels)");
  }

  const channels = (channelRows || []) as ChannelRow[];
  if (channels.length === 0) {
    return NextResponse.json({
      portal,
      health: {
        total_channels: 0,
        active_channels: 0,
        channels_with_matches: 0,
        channels_without_matches: 0,
        channels_without_rules: 0,
        channels_with_inactive_rules_only: 0,
        channels_with_subscribers_but_no_matches: 0,
        total_distinct_events_matched: 0,
        total_subscriptions: 0,
        opportunities: [],
      },
      channels: [],
    });
  }

  const channelIds = channels.map((channel) => channel.id);

  const [
    { data: ruleRows, error: rulesError },
    { data: subscriptions, error: subError },
    { data: matchRows, error: matchesError },
  ] = await Promise.all([
    db
      .from("interest_channel_rules")
      .select("id, channel_id, rule_type, rule_payload, priority, is_active, created_at, updated_at")
      .in("channel_id", channelIds)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true }),
    db
      .from("user_channel_subscriptions")
      .select("channel_id")
      .in("channel_id", channelIds),
    db
      .from("event_channel_matches")
      .select("channel_id, event_id, matched_at")
      .eq("portal_id", portalId)
      .in("channel_id", channelIds),
  ]);

  if (rulesError) {
    return adminErrorResponse(rulesError, "GET /api/admin/portals/[id]/channels (rules)");
  }
  if (subError) {
    return adminErrorResponse(subError, "GET /api/admin/portals/[id]/channels (subscriptions)");
  }
  if (matchesError) {
    return adminErrorResponse(matchesError, "GET /api/admin/portals/[id]/channels (matches)");
  }

  const rulesByChannel = new Map<string, RuleRow[]>();
  for (const rule of (ruleRows || []) as RuleRow[]) {
    const existing = rulesByChannel.get(rule.channel_id);
    if (existing) {
      existing.push(rule);
    } else {
      rulesByChannel.set(rule.channel_id, [rule]);
    }
  }

  const subscriptionCountByChannel = new Map<string, number>();
  for (const row of (subscriptions || []) as Array<{ channel_id: string }>) {
    subscriptionCountByChannel.set(
      row.channel_id,
      (subscriptionCountByChannel.get(row.channel_id) || 0) + 1,
    );
  }

  const matchedEventIdsByChannel = new Map<string, Set<number>>();
  const lastMatchedAtByChannel = new Map<string, string>();
  const matchedEventIds = new Set<number>();

  for (const row of (matchRows || []) as Array<{
    channel_id: string;
    event_id: number;
    matched_at: string;
  }>) {
    matchedEventIds.add(row.event_id);

    const existing = matchedEventIdsByChannel.get(row.channel_id);
    if (existing) {
      existing.add(row.event_id);
    } else {
      matchedEventIdsByChannel.set(row.channel_id, new Set<number>([row.event_id]));
    }

    const currentLatest = lastMatchedAtByChannel.get(row.channel_id);
    if (!currentLatest || row.matched_at > currentLatest) {
      lastMatchedAtByChannel.set(row.channel_id, row.matched_at);
    }
  }

  const channelsWithMatches = channels.filter(
    (channel) => (matchedEventIdsByChannel.get(channel.id)?.size || 0) > 0,
  ).length;

  const activeChannels = channels.filter((channel) => channel.is_active).length;
  const channelsWithoutRules = channels.filter((channel) => {
    const rules = rulesByChannel.get(channel.id) || [];
    return rules.length === 0;
  }).length;
  const channelsWithInactiveRulesOnly = channels.filter((channel) => {
    const rules = rulesByChannel.get(channel.id) || [];
    return rules.length > 0 && rules.every((rule) => !rule.is_active);
  }).length;
  const channelsWithSubscribersButNoMatches = channels.filter((channel) => {
    const subscriberCount = subscriptionCountByChannel.get(channel.id) || 0;
    const matchedCount = matchedEventIdsByChannel.get(channel.id)?.size || 0;
    return subscriberCount > 0 && matchedCount === 0;
  }).length;
  const totalSubscriptions = Array.from(subscriptionCountByChannel.values()).reduce(
    (sum, count) => sum + count,
    0,
  );
  const opportunities: string[] = [];
  if (channelsWithoutRules > 0) {
    opportunities.push(
      `${channelsWithoutRules} channel(s) have no rules. Add source/org/tag rules before launch.`,
    );
  }
  if (channelsWithInactiveRulesOnly > 0) {
    opportunities.push(
      `${channelsWithInactiveRulesOnly} channel(s) only have inactive rules. Reactivate or remove stale rules.`,
    );
  }
  if (channelsWithSubscribersButNoMatches > 0) {
    opportunities.push(
      `${channelsWithSubscribersButNoMatches} channel(s) have subscribers but zero matches. Prioritize coverage fixes.`,
    );
  }
  if (channelsWithMatches < activeChannels) {
    opportunities.push(
      `${activeChannels - channelsWithMatches} active channel(s) are not matching events. Expand selectors or source coverage.`,
    );
  }

  return NextResponse.json({
    portal,
    health: {
      total_channels: channels.length,
      active_channels: activeChannels,
      channels_with_matches: channelsWithMatches,
      channels_without_matches: channels.length - channelsWithMatches,
      channels_without_rules: channelsWithoutRules,
      channels_with_inactive_rules_only: channelsWithInactiveRulesOnly,
      channels_with_subscribers_but_no_matches: channelsWithSubscribersButNoMatches,
      total_distinct_events_matched: matchedEventIds.size,
      total_subscriptions: totalSubscriptions,
      opportunities,
    },
    channels: channels.map((channel) => ({
      ...(() => {
        const channelRules = rulesByChannel.get(channel.id) || [];
        const activeRuleCount = channelRules.filter((rule) => rule.is_active).length;
        const subscriptionCount = subscriptionCountByChannel.get(channel.id) || 0;
        const matchedEventCount = matchedEventIdsByChannel.get(channel.id)?.size || 0;
        let qualityStatus: ChannelQualityStatus = "healthy";
        if (channelRules.length === 0 || activeRuleCount === 0) {
          qualityStatus = "no_rules";
        } else if (matchedEventCount === 0 && subscriptionCount > 0) {
          qualityStatus = "subscriber_gap";
        } else if (matchedEventCount === 0) {
          qualityStatus = "no_matches";
        }

        return {
          rule_count: channelRules.length,
          active_rule_count: activeRuleCount,
          quality_status: qualityStatus,
          subscription_count: subscriptionCount,
          matched_event_count: matchedEventCount,
        };
      })(),
      ...channel,
      rules: rulesByChannel.get(channel.id) || [],
      last_matched_at: lastMatchedAtByChannel.get(channel.id) || null,
    })),
  });
}

// POST /api/admin/portals/[id]/channels
export async function POST(request: NextRequest, { params }: Props) {
  if (!ENABLE_INTEREST_CHANNELS_V1) return apiDisabledResponse();

  const sizeCheck = checkBodySize(request, 32_768);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId } = await params;
  const access = await requirePortalAccess(portalId, "POST /api/admin/portals/[id]/channels (portal)");
  if (access.response) return access.response;
  const { db } = access;

  let body: {
    slug?: string;
    name?: string;
    channel_type?: string;
    description?: string | null;
    metadata?: Record<string, unknown>;
    is_active?: boolean;
    sort_order?: number;
    rules?: RuleInput[];
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedSizeCheck = checkParsedBodySize(body, 32_768);
  if (parsedSizeCheck) return parsedSizeCheck;

  if (!isValidChannelSlug(body.slug)) {
    return NextResponse.json({ error: "slug must be kebab-case and 2-80 characters" }, { status: 400 });
  }
  if (!isValidString(body.name, 1, 120)) {
    return NextResponse.json({ error: "name is required (1-120 characters)" }, { status: 400 });
  }
  if (!isValidChannelType(body.channel_type)) {
    return NextResponse.json({ error: "Invalid channel_type" }, { status: 400 });
  }
  if (body.description !== undefined && body.description !== null && !isValidString(body.description, 1, 400)) {
    return NextResponse.json({ error: "description must be 1-400 characters when provided" }, { status: 400 });
  }
  if (body.metadata !== undefined && !isValidRulePayload(body.metadata)) {
    return NextResponse.json({ error: "metadata must be an object" }, { status: 400 });
  }
  if (body.is_active !== undefined && typeof body.is_active !== "boolean") {
    return NextResponse.json({ error: "is_active must be a boolean" }, { status: 400 });
  }
  if (body.sort_order !== undefined && !Number.isInteger(body.sort_order)) {
    return NextResponse.json({ error: "sort_order must be an integer" }, { status: 400 });
  }
  if (body.rules !== undefined && !Array.isArray(body.rules)) {
    return NextResponse.json({ error: "rules must be an array when provided" }, { status: 400 });
  }
  if (Array.isArray(body.rules)) {
    for (const rule of body.rules) {
      const ruleError = validateRuleInput(rule);
      if (ruleError) {
        return NextResponse.json({ error: ruleError }, { status: 400 });
      }
    }
  }

  const { data: channelData, error: createError } = await db
    .from("interest_channels")
    .insert({
      portal_id: portalId,
      slug: body.slug,
      name: body.name,
      channel_type: body.channel_type,
      description: body.description ?? null,
      metadata: body.metadata || {},
      is_active: body.is_active ?? true,
      sort_order: body.sort_order ?? 0,
    })
    .select("id, portal_id, slug, name, channel_type, description, metadata, is_active, sort_order, created_at, updated_at")
    .maybeSingle();

  if (createError) {
    const uniqueViolation = withUniqueViolation(createError, "Channel slug already exists for this portal");
    if (uniqueViolation) return uniqueViolation;
    return adminErrorResponse(createError, "POST /api/admin/portals/[id]/channels (insert channel)");
  }

  const createdChannel = channelData as ChannelRow | null;
  if (!createdChannel) {
    return NextResponse.json({ error: "Failed to create channel" }, { status: 500 });
  }

  let createdRules: RuleRow[] = [];
  if (Array.isArray(body.rules) && body.rules.length > 0) {
    const { data: rulesData, error: createRulesError } = await db
      .from("interest_channel_rules")
      .insert(
        body.rules.map((rule, index) => ({
          channel_id: createdChannel.id,
          rule_type: rule.rule_type,
          rule_payload: rule.rule_payload,
          priority: rule.priority ?? (index + 1) * 100,
          is_active: rule.is_active ?? true,
        })),
      )
      .select("id, channel_id, rule_type, rule_payload, priority, is_active, created_at, updated_at")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true });

    if (createRulesError) {
      await db.from("interest_channels").delete().eq("id", createdChannel.id);
      return adminErrorResponse(createRulesError, "POST /api/admin/portals/[id]/channels (insert rules)");
    }
    createdRules = (rulesData || []) as RuleRow[];
  }

  return NextResponse.json(
    {
      channel: {
        ...createdChannel,
        rules: createdRules,
      },
    },
    { status: 201 },
  );
}
