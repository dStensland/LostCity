import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuthAndParams } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const runtime = "nodejs";

const BodySchema = z.object({
  rsvp_status: z.enum(["going", "maybe", "declined"]),
});

const ParamsSchema = z.object({ id: z.string().uuid() });

type Params = { id: string };

export const PATCH = withAuthAndParams<Params, { body: typeof BodySchema }>(
  { body: BodySchema },
  async (request, { user, serviceClient, params, validated }) => {
    const rl = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
    if (rl) return rl;

    const paramParsed = ParamsSchema.safeParse(params);
    if (!paramParsed.success) {
      return NextResponse.json({ error: "Invalid plan id" }, { status: 400 });
    }

    const { error } = await serviceClient
      .from("plan_invitees")
      .update({
        rsvp_status: validated.body.rsvp_status,
        responded_at: new Date().toISOString(),
      } as never)
      .eq("plan_id", paramParsed.data.id as never)
      .eq("user_id", user.id as never);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
);
