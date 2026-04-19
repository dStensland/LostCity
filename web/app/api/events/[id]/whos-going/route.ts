import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuthAndParams } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const runtime = "nodejs";

const ParamsSchema = z.object({ id: z.string().regex(/^\d+$/) });

type Params = z.infer<typeof ParamsSchema>;

/**
 * GET /api/events/[id]/whos-going
 *
 * Returns the list of profiles who have a "going" plan_invitee row for this
 * event (via plans with anchor_type='event' and visibility in public/friends).
 *
 * Requires auth so we can scope to plans visible to the requesting user.
 */
export const GET = withAuthAndParams<Params>(
  async (request: NextRequest, { serviceClient, params }) => {
    const rl = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
    if (rl) return rl;

    const parsed = ParamsSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
    }
    const eventId = parseInt(parsed.data.id, 10);

    // Find going invitees for public/friends-visible event plans
    const { data, error } = await serviceClient
      .from("plan_invitees")
      .select(`
        user_id,
        rsvp_status,
        profile:profiles!plan_invitees_user_id_fkey (
          id, username, display_name, avatar_url
        ),
        plan:plans!inner (
          id, anchor_event_id, anchor_type, visibility
        )
      `)
      .eq("rsvp_status", "going")
      .eq("plan.anchor_type", "event")
      .eq("plan.anchor_event_id", eventId as never)
      .in("plan.visibility", ["public", "friends"] as never);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Flatten to simple profile list
    type Row = {
      user_id: string;
      profile: { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null;
    };
    const rows = (data as unknown as Row[] | null) ?? [];
    const profiles = rows
      .map((r) => r.profile)
      .filter((p): p is NonNullable<typeof p> => p !== null);

    return NextResponse.json({ profiles, count: profiles.length });
  }
);
