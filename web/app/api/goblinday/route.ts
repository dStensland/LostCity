import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const year = request.nextUrl.searchParams.get("year");

  let query = supabase
    .from("goblin_movies")
    .select("*")
    .order("release_date", { ascending: true, nullsFirst: false });

  if (year === "2025" || year === "2026") {
    query = query.eq("year", parseInt(year));
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
