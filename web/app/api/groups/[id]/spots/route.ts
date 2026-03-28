import { NextResponse } from "next/server";
import { checkBodySize, validationError } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { withAuthAndParams } from "@/lib/api-middleware";
import { logger } from "@/lib/logger";
import { ENABLE_GROUPS_V1 } from "@/lib/launch-flags";
import { MAX_GROUP_SPOT_NOTE_LENGTH } from "@/lib/types/groups";
import type { GroupSpotsResponse } from "@/lib/types/groups";

type RouteParams = { id: string };

/**
 * GET /api/groups/[id]/spots
 * List all spots for a group. Membership required.
 */
export const GET = withAuthAndParams<RouteParams>(async (request, { user, serviceClient, params }) => {
  if (!ENABLE_GROUPS_V1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  const { id: groupId } = params;

  try {
    // Verify membership
    const { data: membership } = await serviceClient
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Fetch spots with venue details and added_by profile
    const { data: spots, error: spotsError } = await serviceClient
      .from("group_spots")
      .select(`
        id,
        group_id,
        venue_id,
        added_by,
        note,
        added_at,
        venues!venue_id(id, name, slug, image_url, neighborhood, address),
        profiles!added_by(display_name, username)
      `)
      .eq("group_id", groupId)
      .order("added_at", { ascending: false });

    if (spotsError) {
      logger.error("Group spots fetch error", spotsError, {
        userId: user.id,
        groupId,
        component: "groups/[id]/spots",
      });
      return NextResponse.json({ error: "Failed to fetch spots" }, { status: 500 });
    }

    type SpotRow = {
      id: string;
      group_id: string;
      venue_id: number;
      added_by: string;
      note: string | null;
      added_at: string;
      venues: {
        id: number;
        name: string;
        slug: string | null;
        image_url: string | null;
        neighborhood: string | null;
        address: string | null;
      } | null;
      profiles: {
        display_name: string | null;
        username: string | null;
      } | null;
    };

    const spotRows = (spots ?? []) as unknown as SpotRow[];
    const formatted = spotRows.map((s) => ({
      id: s.id,
      group_id: s.group_id,
      venue_id: s.venue_id,
      added_by: s.added_by,
      note: s.note,
      added_at: s.added_at,
      venue: s.venues ?? undefined,
      added_by_profile: s.profiles
        ? {
            display_name: s.profiles.display_name,
            username: s.profiles.username,
          }
        : undefined,
    }));

    const response: GroupSpotsResponse = { spots: formatted };
    return NextResponse.json(response);
  } catch (error) {
    logger.error("Group spots GET error", error, { userId: user.id, groupId, component: "groups/[id]/spots" });
    return NextResponse.json({ error: "Failed to fetch spots" }, { status: 500 });
  }
});

/**
 * POST /api/groups/[id]/spots
 * Add a venue to the group's spot list. Membership required.
 * Body: { venue_id: number, note?: string }
 */
export const POST = withAuthAndParams<RouteParams>(async (request, { user, serviceClient, params }) => {
  if (!ENABLE_GROUPS_V1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  const { id: groupId } = params;

  try {
    // Verify membership
    const { data: membership } = await serviceClient
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const body = await request.json();
    const { venue_id, note } = body;

    // Validate venue_id
    if (typeof venue_id !== "number" || !Number.isInteger(venue_id) || venue_id <= 0) {
      return validationError("venue_id is required and must be a positive integer");
    }

    // Validate note
    if (note !== undefined && note !== null) {
      if (typeof note !== "string" || note.length > MAX_GROUP_SPOT_NOTE_LENGTH) {
        return validationError(`note must be at most ${MAX_GROUP_SPOT_NOTE_LENGTH} characters`);
      }
    }

    // Verify venue exists
    const { data: venue } = await serviceClient
      .from("places")
      .select("id, name, slug, image_url, neighborhood, address")
      .eq("id", venue_id)
      .maybeSingle();

    if (!venue) {
      return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    }

    // Insert spot
    const { data: spot, error: insertError } = await serviceClient
      .from("group_spots")
      .insert({
        group_id: groupId,
        venue_id,
        added_by: user.id,
        note: note ?? null,
      } as never)
      .select()
      .single();

    if (insertError) {
      // Unique constraint violation — spot already exists
      if (insertError.code === "23505") {
        return NextResponse.json({ error: "Venue already in group spots" }, { status: 409 });
      }
      logger.error("Group spot insert error", insertError, {
        userId: user.id,
        groupId,
        venueId: venue_id,
        component: "groups/[id]/spots",
      });
      return NextResponse.json({ error: "Failed to add spot" }, { status: 500 });
    }

    type SpotRow = {
      id: string;
      group_id: string;
      venue_id: number;
      added_by: string;
      note: string | null;
      added_at: string;
    };

    type VenueRow = {
      id: number;
      name: string;
      slug: string | null;
      image_url: string | null;
      neighborhood: string | null;
      address: string | null;
    };

    const spotRow = spot as SpotRow;
    const venueRow = venue as VenueRow;

    return NextResponse.json(
      {
        spot: {
          ...spotRow,
          venue: venueRow,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error("Group spots POST error", error, { userId: user.id, groupId, component: "groups/[id]/spots" });
    return NextResponse.json({ error: "Failed to add spot" }, { status: 500 });
  }
});
