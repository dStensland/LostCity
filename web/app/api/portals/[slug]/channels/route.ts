import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { errorApiResponse, type AnySupabase } from "@/lib/api-utils";
import { resolvePortalSlugAlias } from "@/lib/portal-aliases";
import { ENABLE_INTEREST_CHANNELS_V1 } from "@/lib/launch-flags";

type Props = {
  params: Promise<{ slug: string }>;
};

type InterestChannelRow = {
  id: string;
  portal_id: string | null;
  slug: string;
  name: string;
  channel_type: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  is_active: boolean;
  sort_order: number;
};

type UserSubscriptionRow = {
  id: string;
  channel_id: string;
  delivery_mode: string;
  digest_frequency: string | null;
};

function apiDisabledResponse() {
  return NextResponse.json(
    {
      disabled: true,
      channels: [],
      portal: null,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}

// GET /api/portals/[slug]/channels
export async function GET(request: NextRequest, { params }: Props) {
  if (!ENABLE_INTEREST_CHANNELS_V1) return apiDisabledResponse();

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  const canonicalSlug = resolvePortalSlugAlias(slug);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const db = createServiceClient() as unknown as AnySupabase;

  const { data: portalData, error: portalError } = await db
    .from("portals")
    .select("id, slug, name")
    .eq("slug", canonicalSlug)
    .eq("status", "active")
    .maybeSingle();

  if (portalError) {
    return errorApiResponse("Failed to resolve portal", 500);
  }

  const portal = portalData as { id: string; slug: string; name: string } | null;
  if (!portal) {
    return errorApiResponse("Portal not found", 404);
  }

  const { data: channelsData, error: channelsError } = await db
    .from("interest_channels")
    .select("id, portal_id, slug, name, channel_type, description, metadata, is_active, sort_order")
    .eq("is_active", true)
    .or(`portal_id.eq.${portal.id},portal_id.is.null`)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (channelsError) {
    return errorApiResponse("Failed to fetch channels", 500);
  }

  const channels = (channelsData || []) as InterestChannelRow[];

  const subscriptionByChannelId = new Map<string, UserSubscriptionRow>();

  if (user) {
    const { data: subscriptionsData, error: subscriptionsError } = await db
      .from("user_channel_subscriptions")
      .select("id, channel_id, delivery_mode, digest_frequency")
      .eq("user_id", user.id);

    if (subscriptionsError) {
      return errorApiResponse("Failed to fetch subscriptions", 500);
    }

    for (const subscription of (subscriptionsData || []) as UserSubscriptionRow[]) {
      subscriptionByChannelId.set(subscription.channel_id, subscription);
    }
  }

  const payload = {
    portal: {
      id: portal.id,
      slug: portal.slug,
      name: portal.name,
    },
    channels: channels.map((channel) => {
      const subscription = subscriptionByChannelId.get(channel.id) || null;
      return {
        id: channel.id,
        slug: channel.slug,
        name: channel.name,
        channel_type: channel.channel_type,
        description: channel.description,
        metadata: channel.metadata || {},
        scope: channel.portal_id ? "portal" : "global",
        is_subscribed: Boolean(subscription),
        subscription: subscription
          ? {
              id: subscription.id,
              delivery_mode: subscription.delivery_mode,
              digest_frequency: subscription.digest_frequency,
            }
          : null,
      };
    }),
  };

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": user
        ? "private, max-age=60, stale-while-revalidate=120"
        : "public, s-maxage=120, stale-while-revalidate=300",
    },
  });
}
