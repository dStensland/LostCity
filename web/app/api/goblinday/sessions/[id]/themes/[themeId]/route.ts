import { NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";
import { isSessionMember } from "@/lib/goblin-utils";

export const dynamic = "force-dynamic";

// PATCH /api/goblinday/sessions/[id]/themes/[themeId]
// Member-only: toggles theme status between active and canceled
export const PATCH = withAuthAndParams<{ id: string; themeId: string }>(
  async (request, { user, serviceClient, params }) => {
    const sessionId = parseInt(params.id);
    const themeId = parseInt(params.themeId);

    const isMember = await isSessionMember(serviceClient, sessionId, user.id);
    if (!isMember) {
      return NextResponse.json({ error: "Not a member of this session" }, { status: 403 });
    }

    const body = await request.json();
    const status = body.status;
    if (status !== "active" && status !== "canceled") {
      return NextResponse.json(
        { error: "status must be active or canceled" },
        { status: 400 }
      );
    }

    const updates: Record<string, string | null> = { status };
    if (status === "canceled") {
      updates.canceled_at = new Date().toISOString();
    } else {
      updates.canceled_at = null;
    }

    const { data, error } = await serviceClient
      .from("goblin_themes")
      .update(updates as never)
      .eq("id", themeId)
      .eq("session_id", sessionId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Log timeline event with user_id
    await serviceClient
      .from("goblin_timeline")
      .insert({
        session_id: sessionId,
        event_type: status === "canceled" ? "theme_canceled" : "theme_added",
        theme_id: themeId,
        user_id: user.id,
      } as never);

    return NextResponse.json(data);
  }
);
