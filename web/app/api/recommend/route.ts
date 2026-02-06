import { NextResponse } from "next/server";
import { checkBodySize, errorResponse, parseIntParam } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { withOptionalAuth, withAuth } from "@/lib/api-middleware";
import { logger } from "@/lib/logger";

export const GET = withOptionalAuth(async (request, { user, serviceClient }) => {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  if (!user || !serviceClient) {
    return NextResponse.json({ isRecommended: false });
  }

  const { searchParams } = new URL(request.url);
  const eventIdStr = searchParams.get("eventId");
  const venueIdStr = searchParams.get("venueId");
  const organizationId = searchParams.get("organizationId");

  if (!eventIdStr && !venueIdStr && !organizationId) {
    return NextResponse.json({ error: "Missing target" }, { status: 400 });
  }

  // Validate integer IDs
  let eventId: number | null = null;
  let venueId: number | null = null;

  if (eventIdStr) {
    eventId = parseIntParam(eventIdStr);
    if (eventId === null) {
      return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });
    }
  }

  if (venueIdStr) {
    venueId = parseIntParam(venueIdStr);
    if (venueId === null) {
      return NextResponse.json({ error: "Invalid venueId" }, { status: 400 });
    }
  }

  try {
    let query = serviceClient
      .from("recommendations")
      .select("*")
      .eq("user_id", user.id);

    if (eventId) {
      query = query.eq("event_id", eventId);
    } else if (venueId) {
      query = query.eq("venue_id", venueId);
    } else if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      logger.error("Recommendation check error", error);
      return NextResponse.json({ isRecommended: false, error: "Failed to check recommendation" });
    }

    const rec = data as { note?: string | null; visibility?: string | null } | null;

    return NextResponse.json({
      isRecommended: !!rec,
      note: rec?.note || "",
      visibility: rec?.visibility || "public",
    });
  } catch (err) {
    logger.error("Recommendation check exception", err);
    return NextResponse.json({ isRecommended: false, error: "Server error" });
  }
});

export const POST = withAuth(async (request, { user, serviceClient }) => {
  // Check body size (10KB limit)
  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const body = await request.json();
  const { eventId, venueId, organizationId, action, note, visibility } = body;

  if (!eventId && !venueId && !organizationId) {
    return NextResponse.json({ error: "Missing target" }, { status: 400 });
  }

  try {
    if (action === "remove") {
      let query = serviceClient
        .from("recommendations")
        .delete()
        .eq("user_id", user.id);

      if (eventId) {
        query = query.eq("event_id", eventId);
      } else if (venueId) {
        query = query.eq("venue_id", venueId);
      } else if (organizationId) {
        query = query.eq("organization_id", organizationId);
      }

      const { error } = await query;

      if (error) {
        logger.error("Remove recommendation error", error);
        return errorResponse(error, "POST /api/recommend");
      }

      return NextResponse.json({ success: true, isRecommended: false });
    } else {
      // Check if already exists
      let checkQuery = serviceClient
        .from("recommendations")
        .select("id")
        .eq("user_id", user.id);

      if (eventId) {
        checkQuery = checkQuery.eq("event_id", eventId);
      } else if (venueId) {
        checkQuery = checkQuery.eq("venue_id", venueId);
      } else if (organizationId) {
        checkQuery = checkQuery.eq("organization_id", organizationId);
      }

      const { data: existing } = await checkQuery.maybeSingle();

      if (existing) {
        // Update existing
        let updateQuery = serviceClient
          .from("recommendations")
          .update({ note: note || null, visibility: visibility || "public" } as never)
          .eq("user_id", user.id);

        if (eventId) {
          updateQuery = updateQuery.eq("event_id", eventId);
        } else if (venueId) {
          updateQuery = updateQuery.eq("venue_id", venueId);
        } else if (organizationId) {
          updateQuery = updateQuery.eq("organization_id", organizationId);
        }

        const { error } = await updateQuery;

        if (error) {
          logger.error("Update recommendation error", error);
          return errorResponse(error, "POST /api/recommend");
        }
      } else {
        // Create new
        const recData: Record<string, unknown> = {
          user_id: user.id,
          note: note || null,
          visibility: visibility || "public",
        };

        if (eventId) {
          recData.event_id = eventId;
        } else if (venueId) {
          recData.venue_id = venueId;
        } else if (organizationId) {
          recData.organization_id = organizationId;
        }

        const { error } = await serviceClient.from("recommendations").insert(recData as never);

        if (error) {
          logger.error("Create recommendation error", error);
          return errorResponse(error, "POST /api/recommend");
        }
      }

      return NextResponse.json({ success: true, isRecommended: true });
    }
  } catch (err) {
    logger.error("Recommendation action exception", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
});
