import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuthAndParams } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const runtime = "nodejs";

const PatchSchema = z.object({
  title: z.string().max(140).nullable().optional(),
  note: z.string().max(280).nullable().optional(),
  visibility: z.enum(["private", "friends", "public"]).optional(),
  starts_at: z.string().datetime().optional(),
  status: z.enum(["active", "ended", "cancelled"]).optional(),
});

const ParamsSchema = z.object({ id: z.string().uuid() });

type Params = { id: string };

// Plan + invitee reads go through the RLS-scoped `supabase` client so the
// plans_select / plan_invitees_select policies enforce who can see the plan
// and its roster. Anchor and profile lookups stay on `serviceClient` — those
// rows are already user-visible elsewhere in the app and carry no secrets
// beyond what the public entity pages expose.
export const GET = withAuthAndParams<Params>(
  async (request, { serviceClient, supabase, params }) => {
    const rl = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
    if (rl) return rl;

    const paramParsed = ParamsSchema.safeParse(params);
    if (!paramParsed.success) {
      return NextResponse.json({ error: "Invalid plan id" }, { status: 400 });
    }

    const { data: plan, error: pErr } = await supabase
      .from("plans").select("*").eq("id", paramParsed.data.id as never).maybeSingle();
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const p = plan as {
      id: string;
      anchor_type: "event" | "place" | "series";
      anchor_event_id: number | null;
      anchor_place_id: number | null;
      anchor_series_id: string | null;
    };

    const anchor: Record<string, unknown> = {};
    if (p.anchor_type === "event" && p.anchor_event_id) {
      const { data } = await serviceClient.from("events")
        .select("id, title, start_date, image_url")
        .eq("id", p.anchor_event_id as never).maybeSingle();
      anchor.event = data;
    } else if (p.anchor_type === "place" && p.anchor_place_id) {
      const { data } = await serviceClient.from("places")
        .select("id, name, slug, image_url, neighborhood")
        .eq("id", p.anchor_place_id as never).maybeSingle();
      anchor.place = data;
    } else if (p.anchor_type === "series" && p.anchor_series_id) {
      const { data } = await serviceClient.from("series")
        .select("id, title, slug")
        .eq("id", p.anchor_series_id as never).maybeSingle();
      anchor.series = data;
    }

    const { data: invRaw } = await supabase
      .from("plan_invitees")
      .select("plan_id, user_id, rsvp_status, invited_by, invited_at, responded_at, seen_at")
      .eq("plan_id", paramParsed.data.id as never);
    const inv = (invRaw as Array<{ user_id: string }> | null) ?? [];
    const userIds = inv.map((i) => i.user_id);
    const { data: profRaw } = await serviceClient
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", userIds as never);
    const profiles = (profRaw as Array<{ id: string }> | null) ?? [];
    const pMap = new Map(profiles.map((prof) => [prof.id, prof]));
    const invitees = inv.map((i) => ({ ...i, profile: pMap.get(i.user_id) ?? null }));

    return NextResponse.json({ plan, anchor, invitees });
  }
);

export const PATCH = withAuthAndParams<Params, { body: typeof PatchSchema }>(
  { body: PatchSchema },
  async (request, { user, serviceClient, params, validated }) => {
    const rl = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
    if (rl) return rl;

    const paramParsed = ParamsSchema.safeParse(params);
    if (!paramParsed.success) {
      return NextResponse.json({ error: "Invalid plan id" }, { status: 400 });
    }

    const body = validated.body;

    const { data: existing } = await serviceClient
      .from("plans").select("creator_id, status").eq("id", paramParsed.data.id as never).maybeSingle();
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const e = existing as { creator_id: string; status: string };
    if (e.creator_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const updates: Record<string, unknown> = { updated_by: user.id };
    if (body.title !== undefined) updates.title = body.title;
    if (body.note !== undefined) updates.note = body.note;
    if (body.visibility) updates.visibility = body.visibility;
    if (body.starts_at) updates.starts_at = body.starts_at;

    if (body.status) {
      const valid: Record<string, string[]> = {
        planning: ["active", "cancelled"],
        active: ["ended", "cancelled"],
      };
      if (!valid[e.status]?.includes(body.status)) {
        return NextResponse.json(
          { error: `Invalid transition ${e.status} -> ${body.status}` },
          { status: 400 }
        );
      }
      updates.status = body.status;
      if (body.status === "active") updates.started_at = new Date().toISOString();
      if (body.status === "ended") updates.ended_at = new Date().toISOString();
      if (body.status === "cancelled") updates.cancelled_at = new Date().toISOString();
    }

    const { error: uErr } = await serviceClient
      .from("plans").update(updates as never).eq("id", paramParsed.data.id as never);
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
);

export const DELETE = withAuthAndParams<Params>(
  async (request, { user, serviceClient, params }) => {
    const rl = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
    if (rl) return rl;

    const paramParsed = ParamsSchema.safeParse(params);
    if (!paramParsed.success) {
      return NextResponse.json({ error: "Invalid plan id" }, { status: 400 });
    }

    const { data: existing } = await serviceClient
      .from("plans").select("creator_id").eq("id", paramParsed.data.id as never).maybeSingle();
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ((existing as { creator_id: string }).creator_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error: cErr } = await serviceClient
      .from("plans")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        updated_by: user.id,
      } as never)
      .eq("id", paramParsed.data.id as never);
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
);
