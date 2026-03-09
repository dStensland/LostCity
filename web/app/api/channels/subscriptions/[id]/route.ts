import { NextResponse } from "next/server";
import {
  errorApiResponse,
  isValidUUID,
  type AnySupabase,
} from "@/lib/api-utils";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { withAuthAndParams } from "@/lib/api-middleware";
import { ENABLE_INTEREST_CHANNELS_V1 } from "@/lib/launch-flags";

function apiDisabledResponse() {
  return NextResponse.json(
    { error: "Interest Channels API is disabled." },
    { status: 404 },
  );
}

// DELETE /api/channels/subscriptions/[id]
export const DELETE = withAuthAndParams<{ id: string }>(
  async (request, { user, serviceClient, params }) => {
    if (!ENABLE_INTEREST_CHANNELS_V1) return apiDisabledResponse();

    const rateLimitResult = await applyRateLimit(
      request,
      RATE_LIMITS.write,
      getClientIdentifier(request),
    );
    if (rateLimitResult) return rateLimitResult;

    if (!isValidUUID(params.id)) {
      return errorApiResponse("Invalid subscription id", 400);
    }

    const db = serviceClient as AnySupabase;

    const { data: deleted, error: deleteError } = await db
      .from("user_channel_subscriptions")
      .delete()
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (deleteError) {
      return errorApiResponse("Failed to delete subscription", 500);
    }

    if (!deleted) {
      return errorApiResponse("Subscription not found", 404);
    }

    return NextResponse.json({ success: true });
  },
);
