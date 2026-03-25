import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; themeId: string }> }
) {
  const { id, themeId } = await params;
  const sessionId = parseInt(id);
  const supabase = await createClient();

  const body = await request.json();
  const status = body.status;
  if (status !== "active" && status !== "canceled") {
    return NextResponse.json({ error: "status must be active or canceled" }, { status: 400 });
  }

  const updates: any = { status };
  if (status === "canceled") updates.canceled_at = new Date().toISOString();
  else updates.canceled_at = null;

  const { data, error } = await supabase
    .from("goblin_themes")
    .update(updates as never)
    .eq("id", parseInt(themeId))
    .eq("session_id", sessionId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("goblin_timeline")
    .insert({
      session_id: sessionId,
      event_type: status === "canceled" ? "theme_canceled" : "theme_added",
      theme_id: parseInt(themeId),
    } as never);

  return NextResponse.json(data);
}
