import { NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";
import { isSessionMember } from "@/lib/goblin-utils";

export const dynamic = "force-dynamic";

// POST /api/goblinday/sessions/[id]/themes
// Member-only: creates a theme for the session
export const POST = withAuthAndParams<{ id: string }>(
  async (request, { user, serviceClient, params }) => {
    const sessionId = parseInt(params.id);

    const isMember = await isSessionMember(serviceClient, sessionId, user.id);
    if (!isMember) {
      return NextResponse.json({ error: "Not a member of this session" }, { status: 403 });
    }

    const body = await request.json();
    if (!body.label?.trim()) {
      return NextResponse.json({ error: "label required" }, { status: 400 });
    }

    const { data: theme, error } = await serviceClient
      .from("goblin_themes")
      .insert({
        session_id: sessionId,
        label: body.label.trim(),
        created_by: user.id,
      } as never)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const t = theme as { id: number; label: string; status: string };

    // Log timeline event with user_id
    await serviceClient
      .from("goblin_timeline")
      .insert({
        session_id: sessionId,
        event_type: "theme_added",
        theme_id: t.id,
        user_id: user.id,
      } as never);

    return NextResponse.json(t, { status: 201 });
  }
);
