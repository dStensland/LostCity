import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuthAndParams } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const runtime = "nodejs";

const BodySchema = z.object({ user_ids: z.array(z.string().uuid()).min(1).max(50) });
const ParamsSchema = z.object({ id: z.string().uuid() });

type Params = { id: string };

export const POST = withAuthAndParams<Params, { body: typeof BodySchema }>(
  { body: BodySchema },
  async (request, { user, serviceClient, params, validated }) => {
    const rl = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
    if (rl) return rl;

    const paramParsed = ParamsSchema.safeParse(params);
    if (!paramParsed.success) {
      return NextResponse.json({ error: "Invalid plan id" }, { status: 400 });
    }

    const { data: plan } = await serviceClient
      .from("plans").select("creator_id").eq("id", paramParsed.data.id as never).maybeSingle();
    if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ((plan as { creator_id: string }).creator_id !== user.id)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const rows = validated.body.user_ids
      .filter((uid) => uid !== user.id)
      .map((uid) => ({
        plan_id: paramParsed.data.id,
        user_id: uid,
        rsvp_status: "invited" as const,
        invited_by: user.id,
      }));
    if (!rows.length) return NextResponse.json({ ok: true, inserted: 0 });

    const { error } = await serviceClient
      .from("plan_invitees").insert(rows as never);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, inserted: rows.length });
  }
);
