import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { format, startOfDay } from "date-fns";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import { excludeSensitiveEvents } from "@/lib/portal-scope";
import { applyFeedGate } from "@/lib/feed-gate";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import { getUserFollowedEntityIds } from "@/lib/follows";
import { createServiceClient } from "@/lib/supabase/service";
import { ENABLE_INTEREST_CHANNELS_V1 } from "@/lib/launch-flags";
import {
  getUserSubscribedChannelMatchesForEvents,
  type EventChannelMatch,
} from "@/lib/interest-channel-matches";

type FollowingEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  category: string | null;
  image_url: string | null;
  description: string | null;
  ticket_url: string | null;
  source_url: string | null;
  source_id: number | null;
  tags: string[] | null;
  place_id: number | null;
  organization_id: string | null;
  venue: {
    id: number;
    name: string;
    slug: string | null;
    neighborhood: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
  } | null;
  organization: {
    id: string;
    name: string;
    org_type: string | null;
    logo_url: string | null;
  } | null;
};

export async function GET(request: Request) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const supabase = await createClient();
    const portalContext = await resolvePortalQueryContext(supabase, searchParams);
    if (portalContext.hasPortalParamMismatch) {
      return NextResponse.json(
        { error: "portal and portal_id parameters must reference the same portal" },
        { status: 400 },
      );
    }

    const { followedVenueIds: venueIds, followedOrganizationIds: organizationIds } =
      await getUserFollowedEntityIds(supabase, user.id, {
        portalId: portalContext.portalId,
        includeUnscoped: true,
      });

    // If user doesn't follow anything, return empty
    if (venueIds.length === 0 && organizationIds.length === 0) {
      return NextResponse.json({
        events: [],
        hasMore: false,
        message: "Follow venues or organizations to see their events here",
      });
    }

    // Build date range (today onwards)
    const today = format(startOfDay(new Date()), "yyyy-MM-dd");

    // Build query for events from followed venues or organizations
    let query = supabase
      .from("events")
      .select(`
        id,
        title,
        start_date,
        start_time,
        end_time,
        is_all_day,
        is_free,
        price_min,
        price_max,
        category:category_id,
        image_url,
        description,
        ticket_url,
        source_url,
        source_id,
        tags,
        place_id,
        organization_id,
        venue:places!left(
          id,
          name,
          slug,
          neighborhood,
          address,
          city,
          state
        ),
        organization:organizations!left(
          id,
          name,
          org_type,
          logo_url
        )
      `)
      .gte("start_date", today)
      .is("canonical_event_id", null)
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: true })
      .range(offset, offset + limit - 1);

    if (portalContext.portalId) {
      query = query.eq("portal_id", portalContext.portalId);
    }

    query = excludeSensitiveEvents(query);
    query = applyFeedGate(query);

    // Filter by followed venues OR followed organizations
    if (venueIds.length > 0 && organizationIds.length > 0) {
      query = query.or(`place_id.in.(${venueIds.join(",")}),organization_id.in.(${organizationIds.join(",")})`);
    } else if (venueIds.length > 0) {
      query = query.in("place_id", venueIds);
    } else if (organizationIds.length > 0) {
      query = query.in("organization_id", organizationIds);
    }

    const { data: events, error } = await query as { data: FollowingEvent[] | null; error: Error | null };

    if (error) {
      logger.error("Error fetching following events:", error);
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500 }
      );
    }

    let followingChannelCount = 0;
    let channelMatchesByEventId = new Map<number, EventChannelMatch[]>();
    if (ENABLE_INTEREST_CHANNELS_V1 && (events || []).length > 0) {
      const serviceClient = createServiceClient();
      const channelMatchResult = await getUserSubscribedChannelMatchesForEvents(
        serviceClient,
        user.id,
        (events || []).map((event) => ({
          id: event.id,
          source_id: event.source_id,
          organization_id: event.organization_id,
          category: event.category,
          tags: event.tags || [],
          place_id: event.place_id,
          venue: event.venue ? { id: event.venue.id } : null,
        })),
        {
          portalId: portalContext.portalId,
          includeUnscoped: true,
        },
      );
      followingChannelCount = channelMatchResult.subscribedChannelCount;
      channelMatchesByEventId = channelMatchResult.matchesByEventId;
    }

    // Add reason badges
    const eventsWithReasons = (events || []).map((event) => {
      const reasons = [];

      // Check if venue is followed
      if (event.place_id && venueIds.includes(event.place_id)) {
        const venue = event.venue as { name: string } | null;
        reasons.push({
          type: "followed_venue",
          label: "Followed venue",
          detail: venue?.name || "A venue you follow",
        });
      }

      // Check if organization is followed
      if (event.organization_id && organizationIds.includes(event.organization_id)) {
        const organization = event.organization as { name: string } | null;
        reasons.push({
          type: "followed_organization",
          label: "Followed organization",
          detail: organization?.name || "An organization you follow",
        });
      }

      const channelMatches = channelMatchesByEventId.get(event.id) || [];
      if (channelMatches.length > 0) {
        reasons.push({
          type: "followed_channel",
          label: "Matches your channels",
          detail: channelMatches
            .slice(0, 2)
            .map((match) => match.channel_name)
            .join(", "),
        });
      }

      return {
        ...event,
        reasons,
      };
    });

    return NextResponse.json({
      events: eventsWithReasons,
      hasMore: (events?.length || 0) === limit,
      followingVenues: venueIds.length,
      followingOrganizations: organizationIds.length,
      followingChannels: followingChannelCount,
    }, {
      headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    return errorResponse(err, "GET /api/events/following");
  }
}
