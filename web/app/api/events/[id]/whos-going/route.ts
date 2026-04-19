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
 * event. Enforces the plan-visibility contract:
 *   - `visibility='public'`  → any authenticated viewer sees the attendee
 *   - `visibility='friends'` → only friends-of-the-plan-creator (or the
 *                              creator themselves) see the attendee
 *   - `visibility='private'` → excluded entirely
 *
 * The aggregate uses `serviceClient` (RLS-bypass) because the `plan_invitees`
 * RLS policy only allows self / plan creator / fellow invitee — too narrow
 * for the "who's going to this event" aggregate. The visibility check is
 * therefore enforced manually here with an explicit friendship lookup.
 */
export const GET = withAuthAndParams<Params>(
  async (request: NextRequest, { user, serviceClient, params }) => {
    const rl = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
    if (rl) return rl;

    const parsed = ParamsSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
    }
    const eventId = parseInt(parsed.data.id, 10);

    // Fetch the viewer's friend set once — one RPC, in-memory filter after.
    // `get_friend_ids` returns the canonical bidirectional friend list.
    const { data: friendRows } = await serviceClient.rpc(
      "get_friend_ids" as never,
      { user_id: user.id } as never,
    ) as { data: { friend_id: string }[] | null };
    const friendSet = new Set((friendRows ?? []).map((r) => r.friend_id));

    // Find going invitees for public/friends-visible event plans.
    // `creator_id` is pulled so the friendship filter below can gate
    // `visibility='friends'` rows.
    const { data, error } = await serviceClient
      .from("plan_invitees")
      .select(`
        user_id,
        rsvp_status,
        profile:profiles!plan_invitees_user_id_fkey (
          id, username, display_name, avatar_url
        ),
        plan:plans!inner (
          id, creator_id, anchor_event_id, anchor_type, visibility
        )
      `)
      .eq("rsvp_status", "going")
      .eq("plan.anchor_type", "event")
      .eq("plan.anchor_event_id", eventId as never)
      .in("plan.visibility", ["public", "friends"] as never);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    type Row = {
      user_id: string;
      profile: { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null;
      plan: { creator_id: string; visibility: string } | null;
    };
    const rows = (data as unknown as Row[] | null) ?? [];

    // Friendship gate: drop `visibility='friends'` rows unless the viewer is
    // the plan's creator or in the creator's friend set. `visibility='public'`
    // rows pass through unconditionally.
    const visible = rows.filter((r) => {
      if (!r.plan) return false;
      if (r.plan.visibility === "public") return true;
      if (r.plan.visibility !== "friends") return false;
      return r.plan.creator_id === user.id || friendSet.has(r.plan.creator_id);
    });

    const profiles = visible
      .map((r) => r.profile)
      .filter((p): p is NonNullable<typeof p> => p !== null);

    return NextResponse.json({ profiles, count: profiles.length });
  },
);
