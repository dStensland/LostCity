/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { generateInviteCode } from "@/lib/goblin-utils";

export const dynamic = "force-dynamic";

// GET /api/goblinday/sessions
// Returns only sessions the authenticated user is a member of
export const GET = withAuth(async (_request, { user, serviceClient }) => {
  // Get all session IDs this user belongs to
  const { data: memberships, error: membershipError } = await serviceClient
    .from("goblin_session_members")
    .select("session_id")
    .eq("user_id", user.id);

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  const sessionIds = (memberships ?? []).map((m: { session_id: number }) => m.session_id);

  if (sessionIds.length === 0) {
    return NextResponse.json([]);
  }

  const { data: sessions, error } = await serviceClient
    .from("goblin_sessions")
    .select(`
      id, name, date, status, invite_code, created_by, created_at,
      goblin_session_movies(movie_id),
      goblin_themes(id, label, status),
      goblin_session_members(user_id, role)
    `)
    .in("id", sessionIds)
    .order("date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch profile names for all members across sessions
  const allUserIds = [...new Set(
    (sessions ?? []).flatMap((s: any) =>
      (s.goblin_session_members ?? []).map((m: any) => m.user_id)
    )
  )];
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

  const result = (sessions ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    date: s.date,
    status: s.status,
    invite_code: s.invite_code,
    created_by: s.created_by,
    created_at: s.created_at,
    movie_count: s.goblin_session_movies?.length ?? 0,
    themes: (s.goblin_themes ?? [])
      .filter((t: any) => t.status === "active")
      .map((t: any) => t.label),
    canceled_themes: (s.goblin_themes ?? [])
      .filter((t: any) => t.status === "canceled")
      .map((t: any) => t.label),
    members: (s.goblin_session_members ?? []).map((m: any) => ({
      user_id: m.user_id,
      role: m.role,
      display_name: profileMap[m.user_id]?.display_name ?? null,
      avatar_url: profileMap[m.user_id]?.avatar_url ?? null,
    })),
  }));

  return NextResponse.json(result);
});

// POST /api/goblinday/sessions
// Creates a new session in 'planning' state, auto-joins creator as host
export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  let body: { name?: string; date?: string } = {};
  try {
    body = await request.json();
  } catch {
    // body is optional
  }

  const inviteCode = generateInviteCode();

  const insertData: Record<string, unknown> = {
    name: body.name ?? null,
    status: "planning",
    invite_code: inviteCode,
    created_by: user.id,
  };
  if (body.date) insertData.date = body.date;

  const { data: session, error } = await serviceClient
    .from("goblin_sessions")
    .insert(insertData as never)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const s = session as { id: number };

  // Auto-add creator as host
  const { error: memberError } = await serviceClient
    .from("goblin_session_members")
    .insert({
      session_id: s.id,
      user_id: user.id,
      role: "host",
    } as never);

  if (memberError) {
    // Rollback session if member insert fails
    await serviceClient.from("goblin_sessions").delete().eq("id", s.id);
    return NextResponse.json({ error: "Failed to create session membership" }, { status: 500 });
  }

  return NextResponse.json(session, { status: 201 });
});
