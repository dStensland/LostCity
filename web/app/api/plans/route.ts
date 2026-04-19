import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import type { PlanAnchorType } from "@/lib/types/plans";

export const runtime = "nodejs";

const CreatePlanSchema = z.object({
  anchor_type: z.enum(["event", "place", "series"]),
  anchor_id: z.union([z.number().int().positive(), z.string().uuid()]),
  portal_id: z.string().uuid(),
  starts_at: z.string().datetime(),
  visibility: z.enum(["private", "friends", "public"]).optional(),
  title: z.string().max(140).optional(),
  note: z.string().max(280).optional(),
  invite_user_ids: z.array(z.string().uuid()).max(50).optional(),
});

async function anchorPortalId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  anchor_type: PlanAnchorType,
  anchor_id: number | string
): Promise<string | null> {
  const table =
    anchor_type === "event" ? "events" :
    anchor_type === "place" ? "places" : "series";
  const { data, error } = await service.from(table)
    .select("portal_id")
    .eq("id", anchor_id as never)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { portal_id: string }).portal_id;
}

export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const rl = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rl) return rl;

  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = CreatePlanSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;

  const anchorPortal = await anchorPortalId(serviceClient, input.anchor_type, input.anchor_id);
  if (!anchorPortal) return NextResponse.json({ error: "Anchor not found" }, { status: 404 });
  if (anchorPortal !== input.portal_id) {
    return NextResponse.json({ error: "portal_id does not match anchor's portal" }, { status: 400 });
  }

  const anchorCol =
    input.anchor_type === "event" ? "anchor_event_id" :
    input.anchor_type === "place" ? "anchor_place_id" : "anchor_series_id";

  const { data: planInsert, error: planErr } = await serviceClient
    .from("plans")
    .insert({
      creator_id: user.id,
      portal_id: input.portal_id,
      [anchorCol]: input.anchor_id,
      starts_at: input.starts_at,
      visibility: input.visibility ?? "friends",
      title: input.title ?? null,
      note: input.note ?? null,
      updated_by: user.id,
    } as never)
    .select("id, share_token")
    .single();

  if (planErr || !planInsert) {
    return NextResponse.json({ error: planErr?.message ?? "Insert failed" }, { status: 500 });
  }

  const plan = planInsert as { id: string; share_token: string };

  // Creator is always a plan_invitees row with rsvp_status='going'
  const { error: creatorInviteErr } = await serviceClient
    .from("plan_invitees")
    .insert({
      plan_id: plan.id,
      user_id: user.id,
      rsvp_status: "going",
      invited_by: user.id,
      responded_at: new Date().toISOString(),
    } as never);

  if (creatorInviteErr) {
    // Cleanup — delete orphaned plan
    await serviceClient.from("plans").delete().eq("id", plan.id as never);
    return NextResponse.json({ error: creatorInviteErr.message }, { status: 500 });
  }

  if (input.invite_user_ids && input.invite_user_ids.length > 0) {
    const rows = input.invite_user_ids
      .filter((uid) => uid !== user.id)
      .map((uid) => ({
        plan_id: plan.id,
        user_id: uid,
        rsvp_status: "invited" as const,
        invited_by: user.id,
      }));
    if (rows.length) {
      await serviceClient.from("plan_invitees").insert(rows as never);
    }
  }

  return NextResponse.json({ plan: { id: plan.id, share_token: plan.share_token } }, { status: 201 });
});

const ListQuerySchema = z.object({
  scope: z.enum(["mine", "friends"]).optional().default("mine"),
  status: z.enum(["upcoming", "active", "past"]).optional().default("upcoming"),
  anchor_event_id: z.coerce.number().int().positive().optional(),
  anchor_place_id: z.coerce.number().int().positive().optional(),
});

export const GET = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const rl = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rl) return rl;

  const { searchParams } = new URL(request.url);
  const parsed = ListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const { scope, status, anchor_event_id, anchor_place_id } = parsed.data;

  let query = serviceClient
    .from("plans")
    .select(`
      id, creator_id, portal_id, anchor_type, anchor_event_id, anchor_place_id, anchor_series_id,
      status, starts_at, started_at, ended_at, visibility, title, note, share_token, created_at
    `)
    .order("starts_at", { ascending: status === "upcoming" });

  const now = new Date().toISOString();
  if (status === "upcoming") query = query.in("status", ["planning"] as never).gte("starts_at", now);
  else if (status === "active") query = query.eq("status", "active" as never);
  else if (status === "past") query = query.in("status", ["ended", "expired", "cancelled"] as never);

  if (anchor_event_id) query = query.eq("anchor_event_id", anchor_event_id as never);
  if (anchor_place_id) query = query.eq("anchor_place_id", anchor_place_id as never);

  if (scope === "mine") {
    const { data: invitedIn } = await serviceClient
      .from("plan_invitees")
      .select("plan_id")
      .eq("user_id", user.id as never)
      .eq("rsvp_status", "going" as never);
    const invitedIds = (invitedIn as { plan_id: string }[] | null ?? []).map((r) => r.plan_id);
    query = invitedIds.length > 0
      ? query.or(`creator_id.eq.${user.id},id.in.(${invitedIds.join(",")})`)
      : query.eq("creator_id", user.id as never);
  }
  // scope=friends relies on RLS for plan visibility

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ plans: data ?? [] });
});
