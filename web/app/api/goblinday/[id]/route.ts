import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MUTABLE_FIELDS = new Set([
  "rt_critics_score",
  "rt_audience_score",
  "streaming_info",
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const movieId = parseInt(id);
  if (isNaN(movieId) || movieId <= 0) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const supabase = await createClient();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Filter to only allowed fields
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (MUTABLE_FIELDS.has(key)) {
      updates[key] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("goblin_movies")
    .update(updates as never)
    .eq("id", movieId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
