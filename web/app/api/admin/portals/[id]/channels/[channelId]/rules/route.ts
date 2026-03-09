import { NextRequest, NextResponse } from "next/server";
import { canManagePortal } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  adminErrorResponse,
  checkBodySize,
  checkParsedBodySize,
  isValidUUID,
  type AnySupabase,
} from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { ENABLE_INTEREST_CHANNELS_V1 } from "@/lib/launch-flags";
import {
  isValidRulePayload,
  isValidRuleType,
} from "@/lib/interest-channels";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; channelId: string }>;
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

async function requireManagedChannel(
  portalId: string,
  channelId: string,
  context: string,
) {
  if (!isValidUUID(portalId)) {
    return { response: NextResponse.json({ error: "Invalid portal id" }, { status: 400 }) };
  }
  if (!isValidUUID(channelId)) {
    return { response: NextResponse.json({ error: "Invalid channel id" }, { status: 400 }) };
  }
  if (!(await canManagePortal(portalId))) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const db = createServiceClient() as unknown as AnySupabase;
  const { data: portal, error: portalError } = await db
    .from("portals")
    .select("id")
    .eq("id", portalId)
    .maybeSingle();

  if (portalError) {
    return { response: adminErrorResponse(portalError, `${context} (portal)`), db };
  }
  if (!portal) {
    return { response: NextResponse.json({ error: "Portal not found" }, { status: 404 }), db };
  }

  const { data: channel, error: channelError } = await db
    .from("interest_channels")
    .select("id")
    .eq("id", channelId)
    .eq("portal_id", portalId)
    .maybeSingle();

  if (channelError) {
    return { response: adminErrorResponse(channelError, `${context} (channel)`), db };
  }
  if (!channel) {
    return { response: NextResponse.json({ error: "Channel not found" }, { status: 404 }), db };
  }

  return { db };
}

// GET /api/admin/portals/[id]/channels/[channelId]/rules
export async function GET(request: NextRequest, { params }: Props) {
  if (!ENABLE_INTEREST_CHANNELS_V1) return apiDisabledResponse();

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId, channelId } = await params;
  const access = await requireManagedChannel(
    portalId,
    channelId,
    "GET /api/admin/portals/[id]/channels/[channelId]/rules",
  );
  if (access.response) return access.response;
  const { db } = access;

  const { data: rulesData, error } = await db
    .from("interest_channel_rules")
    .select("id, channel_id, rule_type, rule_payload, priority, is_active, created_at, updated_at")
    .eq("channel_id", channelId)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return adminErrorResponse(error, "GET /api/admin/portals/[id]/channels/[channelId]/rules");
  }

  return NextResponse.json({ rules: (rulesData || []) as RuleRow[] });
}

// POST /api/admin/portals/[id]/channels/[channelId]/rules
export async function POST(request: NextRequest, { params }: Props) {
  if (!ENABLE_INTEREST_CHANNELS_V1) return apiDisabledResponse();

  const sizeCheck = checkBodySize(request, 16_384);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { id: portalId, channelId } = await params;
  const access = await requireManagedChannel(
    portalId,
    channelId,
    "POST /api/admin/portals/[id]/channels/[channelId]/rules",
  );
  if (access.response) return access.response;
  const { db } = access;

  let body: {
    rule_type?: string;
    rule_payload?: Record<string, unknown>;
    priority?: number;
    is_active?: boolean;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedSizeCheck = checkParsedBodySize(body, 16_384);
  if (parsedSizeCheck) return parsedSizeCheck;

  if (!isValidRuleType(body.rule_type)) {
    return NextResponse.json({ error: "Invalid rule_type" }, { status: 400 });
  }
  if (!isValidRulePayload(body.rule_payload)) {
    return NextResponse.json({ error: "rule_payload must be an object" }, { status: 400 });
  }
  if (body.priority !== undefined && !Number.isInteger(body.priority)) {
    return NextResponse.json({ error: "priority must be an integer" }, { status: 400 });
  }
  if (body.is_active !== undefined && typeof body.is_active !== "boolean") {
    return NextResponse.json({ error: "is_active must be a boolean" }, { status: 400 });
  }

  const { data: ruleData, error } = await db
    .from("interest_channel_rules")
    .insert({
      channel_id: channelId,
      rule_type: body.rule_type,
      rule_payload: body.rule_payload,
      priority: body.priority ?? 100,
      is_active: body.is_active ?? true,
    })
    .select("id, channel_id, rule_type, rule_payload, priority, is_active, created_at, updated_at")
    .maybeSingle();

  if (error) {
    return adminErrorResponse(error, "POST /api/admin/portals/[id]/channels/[channelId]/rules");
  }

  return NextResponse.json({ rule: ruleData }, { status: 201 });
}
