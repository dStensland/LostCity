import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessionId = parseInt(id);
  const supabase = await createClient();

  const body = await request.json();
  const movieId = body.movie_id;
  if (!movieId) return NextResponse.json({ error: "movie_id required" }, { status: 400 });

  const { data: existing } = await supabase
    .from("goblin_session_movies")
    .select("watch_order")
    .eq("session_id", sessionId)
    .order("watch_order", { ascending: false })
    .limit(1);

  const nextOrder = ((existing?.[0] as { watch_order: number } | undefined)?.watch_order ?? 0) + 1;

  const { error: insertError } = await supabase
    .from("goblin_session_movies")
    .insert({ session_id: sessionId, movie_id: movieId, watch_order: nextOrder } as never);

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await supabase
    .from("goblin_movies")
    .update({ watched: true } as never)
    .eq("id", movieId);

  await supabase
    .from("goblin_timeline")
    .insert({ session_id: sessionId, event_type: "movie_started", movie_id: movieId } as never);

  return NextResponse.json({ watch_order: nextOrder }, { status: 201 });
}
