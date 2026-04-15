import { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";
import GoblinQueuePublicView from "./GoblinQueuePublicView";

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface ProfileNameRow {
  display_name: string | null;
}

interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface QueueMovieRow {
  id: number;
  tmdb_id: number | null;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  genres: string[] | null;
  runtime_minutes: number | null;
  director: string | null;
  year: number | null;
}

interface QueueEntryRow {
  id: number;
  note: string | null;
  sort_order: number | null;
  added_at: string;
  movie: QueueMovieRow;
}

interface RecommendationMovieRow {
  id: number;
  tmdb_id: number | null;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  year: number | null;
}

interface RecommendationRow {
  id: number;
  recommender_name: string;
  note: string | null;
  created_at: string;
  movie: RecommendationMovieRow;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const serviceClient = createServiceClient();
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("display_name")
    .eq("username", slug)
    .maybeSingle<ProfileNameRow>();
  const name = profile?.display_name || slug;

  return {
    title: `${name}'s Queue — Goblin Day`,
    description: `${name}'s movie watchlist on Goblin Day`,
    openGraph: {
      title: `${name}'s Queue`,
      description: `${name}'s movie queue — see what they want to watch`,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${name}'s Queue — Goblin Day`,
    },
  };
}

export default async function PublicQueuePage({ params }: PageProps) {
  const { slug } = await params;

  const serviceClient = createServiceClient();

  // Look up user
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("username", slug)
    .maybeSingle<ProfileRow>();

  if (!profile) {
    return (
      <main className="min-h-screen bg-[var(--void)] flex items-center justify-center">
        <p className="text-[var(--muted)] font-mono text-sm">User not found</p>
      </main>
    );
  }

  const userId = profile.id;

  // Fetch watchlist entries
  const { data: entries } = await serviceClient
    .from("goblin_watchlist_entries")
    .select(`
      id, note, sort_order, added_at,
      movie:goblin_movies!movie_id (
        id, tmdb_id, title, poster_path, release_date, genres,
        runtime_minutes, director, year
      )
    `)
    .eq("user_id", userId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .returns<QueueEntryRow[]>();

  // Fetch recommendations (service client bypasses RLS)
  const { data: recommendations } = await serviceClient
    .from("goblin_watchlist_recommendations")
    .select(`
      id, recommender_name, note, created_at,
      movie:goblin_movies!movie_id (
        id, tmdb_id, title, poster_path, release_date, year
      )
    `)
    .eq("target_user_id", userId)
    .in("status", ["pending", "added"])
    .order("recommender_name", { ascending: true })
    .order("created_at", { ascending: false })
    .returns<RecommendationRow[]>();

  return (
    <GoblinQueuePublicView
      user={{
        username: profile.username,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
      }}
      slug={slug}
      entries={entries || []}
      recommendations={recommendations || []}
    />
  );
}
