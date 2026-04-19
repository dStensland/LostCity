import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuthAndParams } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const runtime = "nodejs";

const ParamsSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
});

type Params = { id: string; userId: string };

export const DELETE = withAuthAndParams<Params>(
  async (request, { user, serviceClient, params }) => {
    const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
    if (rateLimitResult) return rateLimitResult;
    const paramParsed = ParamsSchema.safeParse(params);
    if (!paramParsed.success) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const { id, userId } = paramParsed.data;

    if (userId !== user.id) {
      const { data } = await serviceClient
        .from("plans").select("creator_id").eq("id", id as never).maybeSingle();
      if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if ((data as { creator_id: string }).creator_id !== user.id)
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: plan } = await serviceClient
      .from("plans").select("creator_id").eq("id", id as never).maybeSingle();
    if (plan && (plan as { creator_id: string }).creator_id === userId) {
      return NextResponse.json(
        { error: "Cannot remove creator; cancel the plan instead" },
        { status: 400 }
      );
    }

    const { error } = await serviceClient
      .from("plan_invitees")
      .delete()
      .eq("plan_id", id as never)
      .eq("user_id", userId as never);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
);
