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
      id, name, date, status, invite_code, created_at,
      goblin_session_members(user_id, role, profiles(display_name, avatar_url))
    `)
    .eq("invite_code", code)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const s = session as any;
  const members = (s.goblin_session_members ?? []).map((m: any) => ({
    user_id: m.user_id,
    role: m.role,
    display_name: m.profiles?.display_name ?? null,
    avatar_url: m.profiles?.avatar_url ?? null,
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

  return NextResponse.json({
    id: s.id,
    name: s.name,
    date: s.date,
    status: s.status,
    invite_code: s.invite_code,
    created_at: s.created_at,
    member_count: members.length,
    members,
    is_member,
  });
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
