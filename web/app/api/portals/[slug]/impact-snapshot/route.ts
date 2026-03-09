import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getPortalBySlug } from "@/lib/portal";
import { resolvePortalSlugAlias } from "@/lib/portal-aliases";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { errorApiResponse, type AnySupabase } from "@/lib/api-utils";
import { ENABLE_INTEREST_CHANNELS_V1 } from "@/lib/launch-flags";
import { logger } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

type ChannelIdRow = { id: string };
type EventChannelMatchRow = { event_id: number };
type UserSubscriptionRow = { channel_id: string };

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIsoDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function getActivePortalChannelIds(
  db: AnySupabase,
  portalId: string,
): Promise<string[]> {
  const { data, error } = await db
    .from("interest_channels")
    .select("id")
    .eq("is_active", true)
    .eq("portal_id", portalId);

  if (error) {
    throw new Error(`Failed to load active channels: ${error.message}`);
  }

  return ((data || []) as ChannelIdRow[]).map((row) => row.id);
}

async function countDistinctMatchedEvents(
  db: AnySupabase,
  portalId: string,
  channelIds: string[],
  startDate: string,
  endDate: string,
): Promise<number> {
  if (channelIds.length === 0) return 0;

  const { data, error } = await db
    .from("event_channel_matches")
    .select("event_id, events!inner(id, start_date, is_active)")
    .eq("portal_id", portalId)
    .in("channel_id", channelIds)
    .eq("events.is_active", true)
    .gte("events.start_date", startDate)
    .lte("events.start_date", endDate);

  if (error) {
    throw new Error(`Failed to count matched events: ${error.message}`);
  }

  const rows = (data || []) as EventChannelMatchRow[];
  return new Set(rows.map((row) => row.event_id)).size;
}

async function getUserSubscribedChannelIds(
  db: AnySupabase,
  userId: string,
  portalId: string,
): Promise<string[]> {
  const { data, error } = await db
    .from("user_channel_subscriptions")
    .select("channel_id, channel:interest_channels!inner(id, portal_id, is_active)")
    .eq("user_id", userId)
    .eq("channel.is_active", true)
    .eq("channel.portal_id", portalId);

  if (error) {
    throw new Error(`Failed to load user subscriptions: ${error.message}`);
  }

  return ((data || []) as UserSubscriptionRow[]).map((row) => row.channel_id);
}

async function getChannelIdsByType(
  db: AnySupabase,
  portalId: string,
  types: string[],
): Promise<string[]> {
  const { data, error } = await db
    .from("interest_channels")
    .select("id")
    .eq("is_active", true)
    .eq("portal_id", portalId)
    .in("channel_type", types);

  if (error) {
    throw new Error(`Failed to load channels by type: ${error.message}`);
  }

  return ((data || []) as ChannelIdRow[]).map((row) => row.id);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  if (!ENABLE_INTEREST_CHANNELS_V1) {
    return NextResponse.json(
      { error: "Interest Channels API is disabled." },
      { status: 404 },
    );
  }

  try {
    const { slug } = await context.params;
    const canonicalSlug = resolvePortalSlugAlias(slug);
    const portal = await getPortalBySlug(canonicalSlug);
    if (!portal) {
      return errorApiResponse("Portal not found", 404);
    }

    const supabase = await createClient();
    const db = createServiceClient() as unknown as AnySupabase;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const startDate = todayIsoDate();
    const endDate = addDaysIsoDate(7);
    const [allPortalChannelIds, meetingChannelIds] = await Promise.all([
      getActivePortalChannelIds(db, portal.id),
      getChannelIdsByType(db, portal.id, ["jurisdiction", "institution"]),
    ]);

    let groupsJoined = 0;
    let matchedOpportunities = 0;
    if (user) {
      const userChannelIds = await getUserSubscribedChannelIds(db, user.id, portal.id);
      groupsJoined = userChannelIds.length;
      matchedOpportunities = await countDistinctMatchedEvents(
        db,
        portal.id,
        userChannelIds.length > 0 ? userChannelIds : allPortalChannelIds,
        startDate,
        endDate,
      );
    } else {
      matchedOpportunities = await countDistinctMatchedEvents(
        db,
        portal.id,
        allPortalChannelIds,
        startDate,
        endDate,
      );
    }

    const newMeetings = await countDistinctMatchedEvents(
      db,
      portal.id,
      meetingChannelIds,
      startDate,
      endDate,
    );

    const payload = {
      week_window_days: 7,
      matched_opportunities: matchedOpportunities,
      groups_joined: groupsJoined,
      new_meetings: newMeetings,
      generated_at: new Date().toISOString(),
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": user
          ? "private, max-age=60, stale-while-revalidate=120"
          : "public, s-maxage=120, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    logger.error("Error in impact-snapshot GET:", error);
    return errorApiResponse("Failed to load impact snapshot", 500);
  }
}
