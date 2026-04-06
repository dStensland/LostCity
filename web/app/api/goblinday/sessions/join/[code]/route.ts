/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { withAuthAndParams } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

// GET /api/goblinday/sessions/join/[code]
// Public: resolves invite code to session info
// If user is authenticated, also returns is_member flag
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const serviceClient = createServiceClient();

  const { data: session, error } = await serviceClient
    .from("goblin_sessions")
    .select(`
      id, name, date, status, invite_code, created_at, guest_names,
      goblin_session_members(user_id, role)
    `)
    .eq("invite_code", code)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const s = session as any;
  const rawMembers = s.goblin_session_members ?? [];

  // Fetch profile names separately
  const memberUserIds = rawMembers.map((m: any) => m.user_id);
  let profileMap: Record<string, { display_name: string; avatar_url: string | null }> = {};
  if (memberUserIds.length > 0) {
    const { data: profiles } = await serviceClient
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", memberUserIds);
    profileMap = Object.fromEntries(
      (profiles ?? []).map((p: any) => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url }])
    );
  }

  const members = rawMembers.map((m: any) => ({
    user_id: m.user_id,
    role: m.role,
    display_name: profileMap[m.user_id]?.display_name ?? null,
    avatar_url: profileMap[m.user_id]?.avatar_url ?? null,
  }));

  // Optionally detect if the current user is already a member
  let is_member = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      is_member = members.some((m: { user_id: string }) => m.user_id === user.id);
    }
  } catch {
    // Not authenticated — is_member stays false
  }

  const baseResponse = {
    id: s.id,
    name: s.name,
    date: s.date,
    status: s.status,
    invite_code: s.invite_code,
    created_at: s.created_at,
    member_count: members.length,
    members,
    guest_names: s.guest_names ?? [],
    is_member,
  };

  // For ended/canceled sessions, include full summary data
  if (s.status === "ended" || s.status === "canceled") {
    const { data: sessionMovies } = await serviceClient
      .from("goblin_session_movies")
      .select("id, movie_id, watch_order, added_at, proposed_by, dnf, goblin_movies(*)")
      .eq("session_id", s.id)
      .order("watch_order");

    const { data: themes } = await serviceClient
      .from("goblin_themes")
      .select("id, label, status, created_at, canceled_at, goblin_theme_movies(movie_id)")
      .eq("session_id", s.id)
      .order("created_at");

    const { data: timeline } = await serviceClient
      .from("goblin_timeline")
      .select("id, event_type, movie_id, theme_id, created_at, user_id")
      .eq("session_id", s.id)
      .order("created_at");

    // Resolve user names for timeline
    const timelineUserIds = [...new Set((timeline ?? []).map((t: any) => t.user_id).filter(Boolean))];
    if (timelineUserIds.length > 0) {
      const { data: tlProfiles } = await serviceClient
        .from("profiles")
        .select("id, display_name")
        .in("id", timelineUserIds);
      const tlMap = Object.fromEntries(
        (tlProfiles ?? []).map((p: any) => [p.id, p.display_name])
      );
      for (const t of (timeline ?? []) as any[]) {
        t.user_name = t.user_id ? tlMap[t.user_id] ?? null : null;
      }
    }

    return NextResponse.json({
      ...baseResponse,
      movies: (sessionMovies ?? []).map((sm: any) => ({
        id: sm.goblin_movies?.id ?? sm.movie_id,
        title: sm.goblin_movies?.title ?? "Unknown",
        poster_path: sm.goblin_movies?.poster_path ?? null,
        watch_order: sm.watch_order,
        dnf: sm.dnf ?? false,
      })),
      themes: (themes ?? []).map((t: any) => ({
        id: t.id,
        label: t.label,
        status: t.status,
        goblin_theme_movies: t.goblin_theme_movies ?? [],
      })),
      timeline: (timeline ?? []).map((t: any) => ({
        id: t.id,
        event_type: t.event_type,
        movie_id: t.movie_id,
        theme_id: t.theme_id,
        created_at: t.created_at,
        user_name: t.user_name ?? null,
      })),
    });
  }

  return NextResponse.json(baseResponse);
}

// POST /api/goblinday/sessions/join/[code]
// Auth required: joins the authenticated user to the session as 'member'
// Only valid for planning or live sessions
export const POST = withAuthAndParams<{ code: string }>(
  async (_request, { user, serviceClient, params }) => {
    const { code } = params;

    const { data: session, error } = await serviceClient
      .from("goblin_sessions")
      .select("id, status")
      .eq("invite_code", code)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const s = session as { id: number; status: string };

    if (s.status === "ended") {
      return NextResponse.json({ error: "This session has already ended" }, { status: 400 });
    }

    // Check if already a member
    const { data: existing } = await serviceClient
      .from("goblin_session_members")
      .select("id, role")
      .eq("session_id", s.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { message: "Already a member", session_id: s.id, role: (existing as { role: string }).role },
        { status: 200 }
      );
    }

    const { error: insertError } = await serviceClient
      .from("goblin_session_members")
      .insert({
        session_id: s.id,
        user_id: user.id,
        role: "member",
      } as never);

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    return NextResponse.json({ joined: true, session_id: s.id }, { status: 201 });
  }
);
