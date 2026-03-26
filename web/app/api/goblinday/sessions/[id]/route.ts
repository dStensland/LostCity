/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";
import { isSessionMember, isSessionHost } from "@/lib/goblin-utils";

export const dynamic = "force-dynamic";

// GET /api/goblinday/sessions/[id]
// Full session detail — member-only
export const GET = withAuthAndParams<{ id: string }>(
  async (_request, { user, serviceClient, params }) => {
    const sessionId = parseInt(params.id);

    const isMember = await isSessionMember(serviceClient, sessionId, user.id);
    if (!isMember) {
      return NextResponse.json({ error: "Not a member of this session" }, { status: 403 });
    }

    const { data: session, error } = await serviceClient
      .from("goblin_sessions")
      .select("id, name, date, status, invite_code, created_by, created_at")
      .eq("id", sessionId)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 404 });

    const s = session as {
      id: number;
      name: string | null;
      date: string | null;
      status: string;
      invite_code: string;
      created_by: string;
      created_at: string;
    };

    // Fetch movies with proposer info
    const { data: sessionMovies } = await serviceClient
      .from("goblin_session_movies")
      .select(`
        id, movie_id, watch_order, added_at, proposed_by,
        goblin_movies(*),
        profiles!goblin_session_movies_proposed_by_fkey(display_name)
      `)
      .eq("session_id", s.id)
      .order("watch_order");

    // Fetch themes
    const { data: themes } = await serviceClient
      .from("goblin_themes")
      .select("id, label, status, created_at, canceled_at, goblin_theme_movies(movie_id)")
      .eq("session_id", s.id)
      .order("created_at");

    // Fetch timeline with user info
    const { data: timeline } = await serviceClient
      .from("goblin_timeline")
      .select(`
        id, event_type, movie_id, theme_id, created_at, user_id,
        profiles!goblin_timeline_user_id_fkey(display_name)
      `)
      .eq("session_id", s.id)
      .order("created_at");

    // Fetch members with profile info
    const { data: members } = await serviceClient
      .from("goblin_session_members")
      .select("user_id, role, joined_at, profiles(display_name, avatar_url)")
      .eq("session_id", s.id);

    return NextResponse.json({
      ...s,
      movies: (sessionMovies ?? []).map((sm: any) => ({
        ...sm.goblin_movies,
        watch_order: sm.watch_order,
        added_at: sm.added_at,
        proposed_by: sm.proposed_by,
        proposed_by_name: sm.profiles?.display_name ?? null,
      })),
      themes: themes ?? [],
      timeline: (timeline ?? []).map((t: any) => ({
        id: t.id,
        event_type: t.event_type,
        movie_id: t.movie_id,
        theme_id: t.theme_id,
        created_at: t.created_at,
        user_id: t.user_id,
        user_name: t.profiles?.display_name ?? null,
      })),
      members: (members ?? []).map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        joined_at: m.joined_at,
        display_name: m.profiles?.display_name ?? null,
        avatar_url: m.profiles?.avatar_url ?? null,
      })),
    });
  }
);

// PATCH /api/goblinday/sessions/[id]
// Host-only: update status (planning→live, live→ended)
export const PATCH = withAuthAndParams<{ id: string }>(
  async (request, { user, serviceClient, params }) => {
    const sessionId = parseInt(params.id);

    const isHost = await isSessionHost(serviceClient, sessionId, user.id);
    if (!isHost) {
      return NextResponse.json({ error: "Only the host can update this session" }, { status: 403 });
    }

    const { data: current, error: fetchError } = await serviceClient
      .from("goblin_sessions")
      .select("status")
      .eq("id", sessionId)
      .single();

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 404 });

    const currentStatus = (current as { status: string }).status;
    const body = await request.json();
    const newStatus = body.status;

    const validTransitions: Record<string, string[]> = {
      planning: ["live"],
      live: ["ended"],
    };

    if (!newStatus || !validTransitions[currentStatus]?.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Cannot transition from '${currentStatus}' to '${newStatus ?? "(none)"}'. Valid: ${validTransitions[currentStatus]?.join(", ") ?? "none"}`,
        },
        { status: 400 }
      );
    }

    const { data, error } = await serviceClient
      .from("goblin_sessions")
      .update({ status: newStatus } as never)
      .eq("id", sessionId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
);

// DELETE /api/goblinday/sessions/[id]
// Host-only
export const DELETE = withAuthAndParams<{ id: string }>(
  async (_request, { user, serviceClient, params }) => {
    const sessionId = parseInt(params.id);

    const isHost = await isSessionHost(serviceClient, sessionId, user.id);
    if (!isHost) {
      return NextResponse.json({ error: "Only the host can delete this session" }, { status: 403 });
    }

    // CASCADE handles session_movies, themes, theme_movies, timeline, members
    const { error } = await serviceClient
      .from("goblin_sessions")
      .delete()
      .eq("id", sessionId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ deleted: true });
  }
);
