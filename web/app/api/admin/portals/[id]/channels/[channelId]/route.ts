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
} from "@/lib/interest-channels";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; channelId: string }>;
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

async function getChannel(
  db: AnySupabase,
  portalId: string,
  channelId: string,
  context: string,
) {
  if (!isValidUUID(channelId)) {
    return { response: NextResponse.json({ error: "Invalid channel id" }, { status: 400 }) };
  }

  const { data: channelData, error } = await db
    .from("interest_channels")
    .select("id, portal_id, slug, name, channel_type, description, metadata, is_active, sort_order, created_at, updated_at")
    .eq("id", channelId)
    .eq("portal_id", portalId)
    .maybeSingle();

  if (error) {
    return { response: adminErrorResponse(error, context) };
  }

  const channel = channelData as ChannelRow | null;
  if (!channel) {
    return { response: NextResponse.json({ error: "Channel not found" }, { status: 404 }) };
  }

  return { channel };
}

async function getChannelRules(db: AnySupabase, channelId: string, context: string) {
  const { data, error } = await db
    .from("interest_channel_rules")
    .select("id, channel_id, rule_type, rule_payload, priority, is_active, created_at, updated_at")
    .eq("channel_id", channelId)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return { response: adminErrorResponse(error, context) };
  }
  return { rules: (data || []) as RuleRow[] };
}

async function getSubscriptionCount(db: AnySupabase, channelId: string, context: string) {
  const { count, error } = await db
    .from("user_channel_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("channel_id", channelId);

  if (error) {
    return { response: adminErrorResponse(error, context) };
  }
  return { count: count || 0 };
}

// GET /api/admin/portals/[id]/channels/[channelId]
export async function GET(request: NextRequest, { params }: Props) {
  if (!ENABLE_INTEREST_CHANNELS_V1) return apiDisabledResponse();

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId, channelId } = await params;
  const access = await requirePortalAccess(portalId, "GET /api/admin/portals/[id]/channels/[channelId] (portal)");
  if (access.response) return access.response;
  const { db } = access;

  const channelResult = await getChannel(
    db,
    portalId,
    channelId,
    "GET /api/admin/portals/[id]/channels/[channelId] (channel)",
  );
  if (channelResult.response) return channelResult.response;

  const [rulesResult, countResult] = await Promise.all([
    getChannelRules(db, channelId, "GET /api/admin/portals/[id]/channels/[channelId] (rules)"),
    getSubscriptionCount(
      db,
      channelId,
      "GET /api/admin/portals/[id]/channels/[channelId] (subscription count)",
    ),
  ]);
  if (rulesResult.response) return rulesResult.response;
  if (countResult.response) return countResult.response;

  return NextResponse.json({
    channel: {
      ...channelResult.channel,
      rules: rulesResult.rules,
      subscription_count: countResult.count,
    },
  });
}

// PATCH /api/admin/portals/[id]/channels/[channelId]
export async function PATCH(request: NextRequest, { params }: Props) {
  if (!ENABLE_INTEREST_CHANNELS_V1) return apiDisabledResponse();

  const sizeCheck = checkBodySize(request, 32_768);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId, channelId } = await params;
  const access = await requirePortalAccess(portalId, "PATCH /api/admin/portals/[id]/channels/[channelId] (portal)");
  if (access.response) return access.response;
  const { db } = access;

  const channelResult = await getChannel(
    db,
    portalId,
    channelId,
    "PATCH /api/admin/portals/[id]/channels/[channelId] (channel)",
  );
  if (channelResult.response) return channelResult.response;

  let body: {
    slug?: string;
    name?: string;
    channel_type?: string;
    description?: string | null;
    metadata?: Record<string, unknown>;
    is_active?: boolean;
    sort_order?: number;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedSizeCheck = checkParsedBodySize(body, 32_768);
  if (parsedSizeCheck) return parsedSizeCheck;

  const updates: Record<string, unknown> = {};

  if (body.slug !== undefined) {
    if (!isValidChannelSlug(body.slug)) {
      return NextResponse.json({ error: "slug must be kebab-case and 2-80 characters" }, { status: 400 });
    }
    updates.slug = body.slug;
  }

  if (body.name !== undefined) {
    if (!isValidString(body.name, 1, 120)) {
      return NextResponse.json({ error: "name must be 1-120 characters" }, { status: 400 });
    }
    updates.name = body.name;
  }

  if (body.channel_type !== undefined) {
    if (!isValidChannelType(body.channel_type)) {
      return NextResponse.json({ error: "Invalid channel_type" }, { status: 400 });
    }
    updates.channel_type = body.channel_type;
  }

  if (body.description !== undefined) {
    if (body.description !== null && !isValidString(body.description, 1, 400)) {
      return NextResponse.json({ error: "description must be 1-400 characters when provided" }, { status: 400 });
    }
    updates.description = body.description;
  }

  if (body.metadata !== undefined) {
    if (!isValidRulePayload(body.metadata)) {
      return NextResponse.json({ error: "metadata must be an object" }, { status: 400 });
    }
    updates.metadata = body.metadata;
  }

  if (body.is_active !== undefined) {
    if (typeof body.is_active !== "boolean") {
      return NextResponse.json({ error: "is_active must be a boolean" }, { status: 400 });
    }
    updates.is_active = body.is_active;
  }

  if (body.sort_order !== undefined) {
    if (!Number.isInteger(body.sort_order)) {
      return NextResponse.json({ error: "sort_order must be an integer" }, { status: 400 });
    }
    updates.sort_order = body.sort_order;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data: channelData, error: updateError } = await db
    .from("interest_channels")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", channelId)
    .eq("portal_id", portalId)
    .select("id, portal_id, slug, name, channel_type, description, metadata, is_active, sort_order, created_at, updated_at")
    .maybeSingle();

  if (updateError) {
    const uniqueViolation = withUniqueViolation(updateError, "Channel slug already exists for this portal");
    if (uniqueViolation) return uniqueViolation;
    return adminErrorResponse(updateError, "PATCH /api/admin/portals/[id]/channels/[channelId] (update)");
  }

  const updatedChannel = channelData as ChannelRow | null;
  if (!updatedChannel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  return NextResponse.json({ channel: updatedChannel });
}

// DELETE /api/admin/portals/[id]/channels/[channelId]
export async function DELETE(request: NextRequest, { params }: Props) {
  if (!ENABLE_INTEREST_CHANNELS_V1) return apiDisabledResponse();

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId, channelId } = await params;
  const access = await requirePortalAccess(portalId, "DELETE /api/admin/portals/[id]/channels/[channelId] (portal)");
  if (access.response) return access.response;
  const { db } = access;

  if (!isValidUUID(channelId)) {
    return NextResponse.json({ error: "Invalid channel id" }, { status: 400 });
  }

  const { data: deleted, error: deleteError } = await db
    .from("interest_channels")
    .delete()
    .eq("id", channelId)
    .eq("portal_id", portalId)
    .select("id")
    .maybeSingle();

  if (deleteError) {
    return adminErrorResponse(deleteError, "DELETE /api/admin/portals/[id]/channels/[channelId]");
  }
  if (!deleted) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
