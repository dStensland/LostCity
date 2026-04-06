import { NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";
import { isSessionMember } from "@/lib/goblin-utils";

export const dynamic = "force-dynamic";

// POST /api/goblinday/sessions/[id]/movies
// Member-only: adds a movie to the session (session must be 'live')
export const POST = withAuthAndParams<{ id: string }>(
  async (request, { user, serviceClient, params }) => {
    const sessionId = parseInt(params.id);

    const isMember = await isSessionMember(serviceClient, sessionId, user.id);
    if (!isMember) {
      return NextResponse.json({ error: "Not a member of this session" }, { status: 403 });
    }

    // Verify session is live
    const { data: session, error: sessionError } = await serviceClient
      .from("goblin_sessions")
      .select("status")
      .eq("id", sessionId)
      .single();

    if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 404 });

    const status = (session as { status: string }).status;
    if (status !== "live") {
      return NextResponse.json(
        { error: `Session is '${status}' — movies can only be added during a live session` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const movieId = body.movie_id;
    if (!movieId) return NextResponse.json({ error: "movie_id required" }, { status: 400 });

    // Get next watch_order
    const { data: existing } = await serviceClient
      .from("goblin_session_movies")
      .select("watch_order")
      .eq("session_id", sessionId)
      .order("watch_order", { ascending: false })
      .limit(1);

    const nextOrder =
      ((existing?.[0] as { watch_order: number } | undefined)?.watch_order ?? 0) + 1;

    const { error: insertError } = await serviceClient
      .from("goblin_session_movies")
      .insert({
        session_id: sessionId,
        movie_id: movieId,
        watch_order: nextOrder,
        proposed_by: user.id,
      } as never);

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    // Upsert goblin_user_movies watched=true for this user
    await serviceClient
      .from("goblin_user_movies")
      .upsert(
        { user_id: user.id, movie_id: movieId, watched: true } as never,
        { onConflict: "user_id,movie_id" }
      );

    // Log timeline event
    await serviceClient
      .from("goblin_timeline")
      .insert({
        session_id: sessionId,
        event_type: "movie_started",
        movie_id: movieId,
        user_id: user.id,
      } as never);

    return NextResponse.json({ watch_order: nextOrder }, { status: 201 });
  }
);

// PATCH /api/goblinday/sessions/[id]/movies
// Member-only: toggle DNF (did not finish) on a session movie
export const PATCH = withAuthAndParams<{ id: string }>(
  async (request, { user, serviceClient, params }) => {
    const sessionId = parseInt(params.id);

    const isMember = await isSessionMember(serviceClient, sessionId, user.id);
    if (!isMember) {
      return NextResponse.json({ error: "Not a member of this session" }, { status: 403 });
    }

    const body = await request.json();
    const movieId = body.movie_id;
    const dnf = body.dnf;
    if (typeof movieId !== "number" || typeof dnf !== "boolean") {
      return NextResponse.json({ error: "movie_id (number) and dnf (boolean) required" }, { status: 400 });
    }

    const { error } = await serviceClient
      .from("goblin_session_movies")
      .update({ dnf } as never)
      .eq("session_id", sessionId)
      .eq("movie_id", movieId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ dnf });
  }
);
