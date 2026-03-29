import { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";
import GoblinLogPublicView from "./GoblinLogPublicView";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ year?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const serviceClient = createServiceClient();
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("display_name")
    .eq("username", slug)
    .maybeSingle();
  const name = (profile as any)?.display_name || slug;

  return {
    title: `${name}'s Film Log — Goblin Day`,
    description: `${name}'s ranked movie log on Goblin Day`,
    openGraph: {
      title: `${name}'s Film Log`,
      description: `${name}'s ranked movie log — see what they've been watching`,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${name}'s Film Log — Goblin Day`,
    },
  };
}

export default async function PublicLogPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { year } = await searchParams;
  const currentYear = year || new Date().getFullYear().toString();

  const serviceClient = createServiceClient();

  // Look up user
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("username", slug)
    .maybeSingle();

  if (!profile) {
    return (
      <main className="min-h-screen bg-[var(--void)] flex items-center justify-center">
        <p className="text-[var(--muted)] font-mono text-sm">User not found</p>
      </main>
    );
  }

  // Fetch entries
  const { data: entries } = await serviceClient
    .from("goblin_log_entries")
    .select(`
      id, watched_date, note, watched_with, sort_order,
      movie:goblin_movies!movie_id (
        id, tmdb_id, title, poster_path, backdrop_path, release_date, genres,
        runtime_minutes, director, year, rt_critics_score, rt_audience_score,
        tmdb_vote_average, tmdb_vote_count, mpaa_rating, imdb_id, synopsis, trailer_url
      )
    `)
    .eq("user_id", (profile as any).id)
    .gte("watched_date", `${currentYear}-01-01`)
    .lte("watched_date", `${currentYear}-12-31`)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("watched_date", { ascending: false });

  // Fetch tags
  const entryIds = (entries || []).map((e: any) => e.id);
  let entryTags: Record<number, any[]> = {};

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

  const logEntries = (entries || []).map((e: any) => ({
    ...e,
    tags: entryTags[e.id] || [],
  }));

  // Fetch user's tags for filter pills
  const { data: userTags } = await serviceClient
    .from("goblin_tags")
    .select("id, name, color")
    .eq("user_id", (profile as any).id)
    .order("created_at", { ascending: true });

  return (
    <GoblinLogPublicView
      user={{
        username: (profile as any).username,
        displayName: (profile as any).display_name,
        avatarUrl: (profile as any).avatar_url,
      }}
      entries={logEntries}
      tags={userTags || []}
      year={parseInt(currentYear)}
    />
  );
}
