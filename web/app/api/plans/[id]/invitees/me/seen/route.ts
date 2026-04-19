import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuthAndParams } from "@/lib/api-middleware";

export const runtime = "nodejs";

const ParamsSchema = z.object({ id: z.string().uuid() });

type Params = { id: string };

export const PATCH = withAuthAndParams<Params>(
  async (_request, { user, serviceClient, params }) => {
    const paramParsed = ParamsSchema.safeParse(params);
    if (!paramParsed.success) {
      return NextResponse.json({ error: "Invalid plan id" }, { status: 400 });
    }

    const { error } = await serviceClient
      .from("plan_invitees")
      .update({ seen_at: new Date().toISOString() } as never)
      .eq("plan_id", paramParsed.data.id as never)
      .eq("user_id", user.id as never)
      .is("seen_at", null as never);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
);
