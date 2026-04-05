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

    // Fetch movies
    const { data: sessionMovies } = await serviceClient
      .from("goblin_session_movies")
      .select("id, movie_id, watch_order, added_at, proposed_by, goblin_movies(*)")
      .eq("session_id", s.id)
      .order("watch_order");

    // Fetch themes
    const { data: themes } = await serviceClient
      .from("goblin_themes")
      .select("id, label, status, created_at, canceled_at, goblin_theme_movies(movie_id, checked_by, checked_at)")
      .eq("session_id", s.id)
      .order("created_at");

    // Fetch timeline
    const { data: timeline } = await serviceClient
      .from("goblin_timeline")
      .select("id, event_type, movie_id, theme_id, created_at, user_id")
      .eq("session_id", s.id)
      .order("created_at");

    // Fetch members
    const { data: members } = await serviceClient
      .from("goblin_session_members")
      .select("user_id, role, joined_at")
      .eq("session_id", s.id);

    // Collect checked_by UUIDs from theme_movies
    const themeCheckerIds = (themes ?? []).flatMap(
      (t: any) => ((t.goblin_theme_movies as any[]) ?? []).map((tm: any) => tm.checked_by)
    ).filter(Boolean);

    // Collect all user IDs and fetch profiles in one query
    const allUserIds = [...new Set([
      ...(sessionMovies ?? []).map((sm: any) => sm.proposed_by).filter(Boolean),
      ...(timeline ?? []).map((t: any) => t.user_id).filter(Boolean),
      ...(members ?? []).map((m: any) => m.user_id),
      ...themeCheckerIds,
    ])];
    let profileMap: Record<string, { display_name: string; avatar_url: string | null }> = {};
    if (allUserIds.length > 0) {
      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", allUserIds);
      profileMap = Object.fromEntries(
        (profiles ?? []).map((p: any) => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }])
      );
    }

    return NextResponse.json({
      ...s,
      movies: (sessionMovies ?? []).map((sm: any) => ({
        ...sm.goblin_movies,
        watch_order: sm.watch_order,
        added_at: sm.added_at,
        proposed_by: sm.proposed_by,
        proposed_by_name: sm.proposed_by ? profileMap[sm.proposed_by]?.display_name ?? null : null,
      })),
      themes: themes ?? [],
      timeline: (timeline ?? []).map((t: any) => ({
        id: t.id,
        event_type: t.event_type,
        movie_id: t.movie_id,
        theme_id: t.theme_id,
        created_at: t.created_at,
        user_id: t.user_id,
        user_name: t.user_id ? profileMap[t.user_id]?.display_name ?? null : null,
      })),
      members: (members ?? []).map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        joined_at: m.joined_at,
        display_name: profileMap[m.user_id]?.display_name ?? null,
        avatar_url: profileMap[m.user_id]?.avatar_url ?? null,
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
      planning: ["live", "canceled"],
      live: ["ended", "canceled"],
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
