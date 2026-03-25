import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: session, error } = await supabase
    .from("goblin_sessions")
    .select("id, name, date, is_active, created_at")
    .eq("id", parseInt(id))
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const { data: sessionMovies } = await supabase
    .from("goblin_session_movies")
    .select("id, movie_id, watch_order, added_at, goblin_movies(*)")
    .eq("session_id", session.id)
    .order("watch_order");

  const { data: themes } = await supabase
    .from("goblin_themes")
    .select("id, label, status, created_at, canceled_at, goblin_theme_movies(movie_id)")
    .eq("session_id", session.id)
    .order("created_at");

  const { data: timeline } = await supabase
    .from("goblin_timeline")
    .select("id, event_type, movie_id, theme_id, created_at")
    .eq("session_id", session.id)
    .order("created_at");

  return NextResponse.json({
    ...session,
    movies: (sessionMovies ?? []).map((sm: any) => ({
      ...sm.goblin_movies,
      watch_order: sm.watch_order,
      added_at: sm.added_at,
    })),
    themes: themes ?? [],
    timeline: timeline ?? [],
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const body = await request.json();

  if (body.is_active === false) {
    const { data, error } = await supabase
      .from("goblin_sessions")
      .update({ is_active: false } as never)
      .eq("id", parseInt(id))
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "Only ending sessions is supported" }, { status: 400 });
}
