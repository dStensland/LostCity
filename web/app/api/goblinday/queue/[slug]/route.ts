import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface WatchlistMovieRow {
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

interface WatchlistEntryRow {
  id: number;
  note: string | null;
  sort_order: number | null;
  added_at: string;
  movie: WatchlistMovieRow;
}

interface WatchlistTagRow {
  id: number;
  name: string;
  color: string | null;
}

interface WatchlistTagJoinRow {
  entry_id: number;
  tag: WatchlistTagRow | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

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

  // Fetch watchlist entries ordered by sort_order asc then added_at desc
  const { data: entries, error } = await serviceClient
    .from("goblin_watchlist_entries")
    .select(`
      id, note, sort_order, added_at,
      movie:goblin_movies!movie_id (
        id, tmdb_id, title, poster_path, backdrop_path, release_date, genres,
        runtime_minutes, director, year, rt_critics_score, rt_audience_score,
        tmdb_vote_average, tmdb_vote_count, mpaa_rating, imdb_id, synopsis, trailer_url
      )
    `)
    .eq("user_id", profile.id)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("added_at", { ascending: false })
    .returns<WatchlistEntryRow[]>();

  if (error) {
    return NextResponse.json({ error: "Failed to fetch watchlist" }, { status: 500 });
  }

  // Fetch tags for all entries
  const entryIds = (entries || []).map((e) => e.id);
  const entryTags: Record<number, WatchlistTagRow[]> = {};

  if (entryIds.length > 0) {
    const { data: tagRows } = await serviceClient
      .from("goblin_watchlist_entry_tags")
      .select("entry_id, tag:goblin_watchlist_tags!tag_id (id, name, color)")
      .in("entry_id", entryIds)
      .returns<WatchlistTagJoinRow[]>();

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
    entries: result,
    count: result.length,
  });
}
