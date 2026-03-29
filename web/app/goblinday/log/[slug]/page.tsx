import { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";
import GoblinLogPublicView from "./GoblinLogPublicView";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ year?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `${slug}'s Movie Log — Goblin Day`,
    description: `Movies watched by ${slug}`,
    openGraph: {
      title: `${slug}'s Movie Log`,
      description: `Check out what ${slug} has been watching`,
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
        runtime_minutes, director, year
      )
    `)
    .eq("user_id", (profile as any).id)
    .gte("watched_date", `${currentYear}-01-01`)
    .lte("watched_date", `${currentYear}-12-31`)
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

  return (
    <GoblinLogPublicView
      user={{
        username: (profile as any).username,
        displayName: (profile as any).display_name,
        avatarUrl: (profile as any).avatar_url,
      }}
      entries={logEntries}
      year={parseInt(currentYear)}
    />
  );
}
