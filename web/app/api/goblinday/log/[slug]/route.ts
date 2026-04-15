import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface LogMovieRow {
  id: number;
  tmdb_id: number | null;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  genres: string[] | null;
  runtime_minutes: number | null;
  director: string | null;
  year: number | null;
  rt_critics_score: number | null;
  rt_audience_score: number | null;
  tmdb_vote_average: number | null;
  tmdb_vote_count: number | null;
  mpaa_rating: string | null;
  imdb_id: string | null;
  synopsis: string | null;
  trailer_url: string | null;
}

interface LogEntryRow {
  id: number;
  watched_date: string;
  note: string | null;
  watched_with: string | null;
  sort_order: number | null;
  tier_name: string | null;
  tier_color: string | null;
  movie: LogMovieRow;
}

interface LogTagRow {
  id: number;
  name: string;
  color: string | null;
}

interface LogTagJoinRow {
  entry_id: number;
  tag: LogTagRow | null;
}

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
    .maybeSingle<ProfileRow>();

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
    .eq("user_id", profile.id)
    .gte("watched_date", `${year}-01-01`)
    .lte("watched_date", `${year}-12-31`)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("watched_date", { ascending: false })
    .returns<LogEntryRow[]>();

  if (error) {
    return NextResponse.json({ error: "Failed to fetch log" }, { status: 500 });
  }

  // Fetch tags
  const entryIds = (entries || []).map((e) => e.id);
  const entryTags: Record<number, LogTagRow[]> = {};

  if (entryIds.length > 0) {
    const { data: tagRows } = await serviceClient
      .from("goblin_log_entry_tags")
      .select("entry_id, tag:goblin_tags!tag_id (id, name, color)")
      .in("entry_id", entryIds)
      .returns<LogTagJoinRow[]>();

    for (const row of tagRows || []) {
      if (!entryTags[row.entry_id]) entryTags[row.entry_id] = [];
      if (row.tag) entryTags[row.entry_id].push(row.tag);
    }
  }

  const result = (entries || []).map((e) => ({
    ...e,
    tags: entryTags[e.id] || [],
  }));

  return NextResponse.json({
    user: {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
    },
    year: parseInt(year),
    entries: result,
    count: result.length,
  });
}
