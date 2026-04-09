import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const serviceClient = createServiceClient();

  const { data, error } = await serviceClient
    .from("goblin_ranking_games")
    .select("id, name, description, image_url, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
  }

  return NextResponse.json({ games: data });
}
