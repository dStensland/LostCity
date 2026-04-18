import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { GoblinGroupPublicView } from "@/components/goblin/GoblinGroupPublicView";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string; groupSlug: string }>;
}

interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface GroupRow {
  id: number;
  slug: string;
  name: string;
  description: string | null;
}

interface GroupMovieRow {
  movie_id: number;
  sort_order: number | null;
  section: string | null;
  section_sort: number | null;
  added_at: string;
  movie: GroupMovieDetailRow;
}

interface GroupMovieDetailRow {
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
  const { slug, groupSlug } = await params;
  const serviceClient = createServiceClient();

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("display_name")
    .eq("username", slug)
    .maybeSingle<{ display_name: string | null }>();

  const { data: group } = await serviceClient
    .from("goblin_lists")
    .select("name")
    .eq("slug", groupSlug)
    .eq("is_recommendations", false)
    .maybeSingle<{ name: string }>();

  const displayName = profile?.display_name || slug;
  const groupName = group?.name || groupSlug;

  return {
    title: `${groupName} — ${displayName}'s Queue — Goblin Day`,
    description: `${displayName}'s ${groupName} movie group on Goblin Day`,
    openGraph: {
      title: `${groupName} — ${displayName}'s Queue`,
      description: `${displayName}'s ${groupName} group — see what's in the list`,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${groupName} — ${displayName}'s Queue — Goblin Day`,
    },
  };
}

export default async function PublicGroupPage({ params }: PageProps) {
  const { slug, groupSlug } = await params;

  const serviceClient = createServiceClient();

  // Resolve user by username
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("username", slug)
    .maybeSingle<ProfileRow>();

  if (!profile) {
    notFound();
  }

  // Resolve group list by slug + user (non-recommendations only)
  const { data: group } = await serviceClient
    .from("goblin_lists")
    .select("id, slug, name, description")
    .eq("user_id", profile.id)
    .eq("slug", groupSlug)
    .eq("is_recommendations", false)
    .maybeSingle<GroupRow>();

  if (!group) {
    notFound();
  }

  // Fetch movies in the group ordered by sort_order (narrative order).
  // The view groups entries by `section` itself; section display order is
  // derived from each section's minimum sort_order, so we only need the flat
  // stream here.
  const { data: movieRows } = await serviceClient
    .from("goblin_list_movies")
    .select(`
      movie_id, sort_order, section, section_sort, added_at,
      movie:goblin_movies!movie_id (
        id, tmdb_id, title, poster_path, release_date, genres,
        runtime_minutes, director, year
      )
    `)
    .eq("list_id", group.id)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("added_at", { ascending: true })
    .returns<GroupMovieRow[]>();

  // Fetch pending recommendations scoped to this group
  const { data: recRows } = await serviceClient
    .from("goblin_watchlist_recommendations")
    .select(`
      id, recommender_name, note, created_at,
      movie:goblin_movies!movie_id (
        id, tmdb_id, title, poster_path, release_date, year
      )
    `)
    .eq("target_user_id", profile.id)
    .eq("list_id", group.id)
    .eq("status", "pending")
    .order("recommender_name", { ascending: true })
    .order("created_at", { ascending: false })
    .returns<RecommendationRow[]>();

  // Filter out any rows where the movie join returned null
  const entries = (movieRows || [])
    .filter((r) => r.movie !== null)
    .map((r) => ({
      movie_id: r.movie_id,
      section: r.section,
      section_sort: r.section_sort,
      movie: r.movie as GroupMovieDetailRow,
    }));

  const recommendations = (recRows || []).filter((r) => r.movie !== null);

  return (
    <GoblinGroupPublicView
      user={{
        username: profile.username,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
      }}
      slug={slug}
      group={{
        slug: group.slug,
        name: group.name,
        description: group.description,
      }}
      entries={entries}
      recommendations={recommendations as RecommendationRow[]}
    />
  );
}
