import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const serviceClient = createServiceClient();

  // Look up user by username
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("username", slug)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const year = request.nextUrl.searchParams.get("year") || new Date().getFullYear().toString();

  // Fetch log entries for the year
  const { data: entries, error } = await serviceClient
    .from("goblin_log_entries")
    .select(`
      id, watched_date, note, watched_with, sort_order, tier_name, tier_color,
      movie:goblin_movies!movie_id (
        id, tmdb_id, title, poster_path, backdrop_path, release_date, genres,
        runtime_minutes, director, year, rt_critics_score, rt_audience_score,
        tmdb_vote_average, tmdb_vote_count, mpaa_rating, imdb_id, synopsis, trailer_url
      )
    `)
    .eq("user_id", (profile as any).id)
    .gte("watched_date", `${year}-01-01`)
    .lte("watched_date", `${year}-12-31`)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("watched_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch log" }, { status: 500 });
  }

  // Fetch tags
  const entryIds = (entries || []).map((e: any) => e.id);
  const entryTags: Record<number, { id: number; name: string; color: string | null }[]> = {};

  if (entryIds.length > 0) {
    const { data: tagRows } = await serviceClient
      .from("goblin_log_entry_tags")
      .select("entry_id, tag:goblin_tags!tag_id (id, name, color)")
      .in("entry_id", entryIds);

    for (const row of tagRows || []) {
      const r = row as any;
      if (!entryTags[r.entry_id]) entryTags[r.entry_id] = [];
      if (r.tag) entryTags[r.entry_id].push(r.tag);
    }
  }

  const result = (entries || []).map((e: any) => ({
    ...e,
    tags: entryTags[e.id] || [],
  }));

  return NextResponse.json({
    user: {
      username: (profile as any).username,
      display_name: (profile as any).display_name,
      avatar_url: (profile as any).avatar_url,
    },
    year: parseInt(year),
    entries: result,
    count: result.length,
  });
}
