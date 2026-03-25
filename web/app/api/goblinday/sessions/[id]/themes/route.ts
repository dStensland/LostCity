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
  if (!body.label?.trim()) return NextResponse.json({ error: "label required" }, { status: 400 });

  const { data: theme, error } = await supabase
    .from("goblin_themes")
    .insert({ session_id: sessionId, label: body.label.trim() } as never)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.movie_ids?.length > 0) {
    const rows = body.movie_ids.map((mid: number) => ({
      theme_id: theme.id,
      movie_id: mid,
    }));
    await supabase.from("goblin_theme_movies").insert(rows as never);
  }

  await supabase
    .from("goblin_timeline")
    .insert({ session_id: sessionId, event_type: "theme_added", theme_id: theme.id } as never);

  return NextResponse.json(theme, { status: 201 });
}
