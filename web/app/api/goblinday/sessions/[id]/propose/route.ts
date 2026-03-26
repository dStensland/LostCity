import { NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";
import { isSessionMember } from "@/lib/goblin-utils";

export const dynamic = "force-dynamic";

// POST /api/goblinday/sessions/[id]/propose
// Member-only: proposes a movie for the session (session must be 'planning')
export const POST = withAuthAndParams<{ id: string }>(
  async (request, { user, serviceClient, params }) => {
    const sessionId = parseInt(params.id);

    const isMember = await isSessionMember(serviceClient, sessionId, user.id);
    if (!isMember) {
      return NextResponse.json({ error: "Not a member of this session" }, { status: 403 });
    }

    // Verify session is in planning state
    const { data: session, error: sessionError } = await serviceClient
      .from("goblin_sessions")
      .select("status")
      .eq("id", sessionId)
      .single();

    if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 404 });

    const status = (session as { status: string }).status;
    if (status !== "planning") {
      return NextResponse.json(
        { error: `Session is '${status}' — movies can only be proposed during planning` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const movieId = body.movie_id;
    if (!movieId) return NextResponse.json({ error: "movie_id required" }, { status: 400 });

    // Check for duplicate proposal
    const { data: existing } = await serviceClient
      .from("goblin_session_movies")
      .select("id")
      .eq("session_id", sessionId)
      .eq("movie_id", movieId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Movie already proposed for this session" }, { status: 409 });
    }

    const { data: proposal, error: insertError } = await serviceClient
      .from("goblin_session_movies")
      .insert({
        session_id: sessionId,
        movie_id: movieId,
        proposed_by: user.id,
        watch_order: 0,
      } as never)
      .select()
      .single();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    // Log timeline event
    await serviceClient
      .from("goblin_timeline")
      .insert({
        session_id: sessionId,
        event_type: "movie_proposed",
        movie_id: movieId,
        user_id: user.id,
      } as never);

    return NextResponse.json(proposal, { status: 201 });
  }
);
