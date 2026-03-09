import { NextResponse } from "next/server";
import {
  checkBodySize,
  errorApiResponse,
  isValidUUID,
  validationError,
  type AnySupabase,
} from "@/lib/api-utils";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { withAuth } from "@/lib/api-middleware";
import { ENABLE_INTEREST_CHANNELS_V1 } from "@/lib/launch-flags";
import {
  isValidDeliveryMode,
  isValidDigestFrequency,
} from "@/lib/interest-channels";
import { resolvePortalAttributionForWrite } from "@/lib/portal-attribution";

function apiDisabledResponse() {
  return NextResponse.json(
    { error: "Interest Channels API is disabled." },
    { status: 404 },
  );
}

type SubscribeBody = {
  channel_id?: string;
  delivery_mode?: "feed_only" | "instant" | "digest";
  digest_frequency?: "daily" | "weekly";
};

// POST /api/channels/subscriptions
export const POST = withAuth(async (request, { user, serviceClient }) => {
  if (!ENABLE_INTEREST_CHANNELS_V1) return apiDisabledResponse();

  const sizeCheck = checkBodySize(request, 4096);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.write,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  let body: SubscribeBody;
  try {
    body = (await request.json()) as SubscribeBody;
  } catch {
    return validationError("Invalid JSON body");
  }

  if (!isValidUUID(body.channel_id)) {
    return validationError("channel_id is required and must be a valid UUID");
  }

  const deliveryMode = body.delivery_mode || "feed_only";
  if (!isValidDeliveryMode(deliveryMode)) {
    return validationError("Invalid delivery_mode");
  }

  const digestFrequency = body.digest_frequency ?? null;
  if (digestFrequency && !isValidDigestFrequency(digestFrequency)) {
    return validationError("Invalid digest_frequency");
  }

  if (deliveryMode === "digest" && !digestFrequency) {
    return validationError("digest_frequency is required when delivery_mode is 'digest'");
  }

  const attribution = await resolvePortalAttributionForWrite(request, {
    endpoint: "/api/channels/subscriptions",
    body,
    requireWhenHinted: true,
  });
  if (attribution.response) return attribution.response;

  const db = serviceClient as AnySupabase;

  const { data: channelData, error: channelError } = await db
    .from("interest_channels")
    .select("id, portal_id, is_active")
    .eq("id", body.channel_id)
    .maybeSingle();

  if (channelError) {
    return errorApiResponse("Failed to validate channel", 500);
  }

  const channel = channelData as {
    id: string;
    portal_id: string | null;
    is_active: boolean;
  } | null;

  if (!channel || !channel.is_active) {
    return errorApiResponse("Channel not found", 404);
  }

  if (
    attribution.portalId &&
    channel.portal_id &&
    channel.portal_id !== attribution.portalId
  ) {
    return errorApiResponse("Channel is not available in this portal", 403);
  }

  const subscriptionPayload = {
    user_id: user.id,
    channel_id: channel.id,
    portal_id: attribution.portalId || channel.portal_id || null,
    delivery_mode: deliveryMode,
    digest_frequency: deliveryMode === "digest" ? digestFrequency : null,
    updated_at: new Date().toISOString(),
  };

  const { data: subscriptionData, error: upsertError } = await db
    .from("user_channel_subscriptions")
    .upsert(subscriptionPayload, { onConflict: "user_id,channel_id" })
    .select("id, channel_id, portal_id, delivery_mode, digest_frequency")
    .single();

  if (upsertError) {
    return errorApiResponse("Failed to create subscription", 500);
  }

  return NextResponse.json({
    success: true,
    subscription: subscriptionData,
  });
});
