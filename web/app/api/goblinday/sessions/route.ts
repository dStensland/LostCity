import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  const { data: sessions, error } = await supabase
    .from("goblin_sessions")
    .select(`
      id, name, date, is_active, created_at,
      goblin_session_movies(movie_id),
      goblin_themes(id, label, status)
    `)
    .order("date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = (sessions ?? []).map((s: any) => ({
    ...s,
    movie_count: s.goblin_session_movies?.length ?? 0,
    themes: (s.goblin_themes ?? []).filter((t: any) => t.status === "active").map((t: any) => t.label),
    canceled_themes: (s.goblin_themes ?? []).filter((t: any) => t.status === "canceled").map((t: any) => t.label),
    goblin_session_movies: undefined,
    goblin_themes: undefined,
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: active } = await supabase
    .from("goblin_sessions")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  if (active) {
    return NextResponse.json({ error: "A session is already active", active_id: (active as { id: number }).id }, { status: 400 });
  }

  let body: { name?: string } = {};
  try { body = await request.json(); } catch {}

  const { data, error } = await supabase
    .from("goblin_sessions")
    .insert({ name: body.name || null } as never)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
