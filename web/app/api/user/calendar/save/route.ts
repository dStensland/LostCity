import { NextResponse } from "next/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { parseIntParam, validationError, checkBodySize } from "@/lib/api-utils";
import { withOptionalAuth } from "@/lib/api-middleware";
import { ensureUserProfile } from "@/lib/user-utils";
import { resolvePortalAttributionForWrite } from "@/lib/portal-attribution";
import { resolveSessionEngagementContext } from "@/lib/session-engagement";
import { logger } from "@/lib/logger";

const VALID_PROVIDERS = new Set(["google", "outlook", "ics"]);

export const POST = withOptionalAuth(async (request, { user, serviceClient }) => {
  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  const rateLimitId = user ? `${user.id}:${getClientIdentifier(request)}` : getClientIdentifier(request);
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  try {
    const body = await request.json();
    const eventId = parseIntParam(body?.event_id);
    const provider = typeof body?.provider === "string" ? body.provider.toLowerCase() : "";

    if (eventId === null || eventId <= 0) {
      return validationError("Invalid event_id");
    }

    if (!VALID_PROVIDERS.has(provider)) {
      return validationError("Invalid provider. Must be one of: google, outlook, ics");
    }

    // Calendar links still work for anonymous users; persistence is auth-only.
    if (!user || !serviceClient) {
      return NextResponse.json({ success: true, persisted: false }, { status: 202 });
    }

    await ensureUserProfile(user, serviceClient);

    const attribution = await resolvePortalAttributionForWrite(request, {
      endpoint: "/api/user/calendar/save",
      body,
      requireWhenHinted: true,
    });
    if (attribution.response) return attribution.response;

    const engagementContext = await resolveSessionEngagementContext(serviceClient, eventId);

    const { error } = await serviceClient
      .from("event_calendar_saves")
      .upsert(
        {
          user_id: user.id,
          event_id: eventId,
          provider,
          engagement_target: engagementContext.engagement_target,
          festival_id: engagementContext.festival_id,
          program_id: engagementContext.program_id,
          updated_at: new Date().toISOString(),
          ...(attribution.portalId ? { portal_id: attribution.portalId } : {}),
        } as never,
        { onConflict: "user_id,event_id,provider" }
      );

    if (error) {
      logger.error("Calendar save insert error", error, {
        userId: user.id,
        eventId,
        provider,
        component: "calendar-save",
      });
      return NextResponse.json({ error: "Failed to save calendar intent" }, { status: 500 });
    }

    return NextResponse.json({ success: true, persisted: true });
  } catch (error) {
    logger.error("Calendar save API error", error, {
      userId: user?.id ?? null,
      component: "calendar-save",
    });
    return NextResponse.json({ error: "Failed to save calendar intent" }, { status: 500 });
  }
});
