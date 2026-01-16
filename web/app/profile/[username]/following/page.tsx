import { notFound } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import UserList from "@/components/UserList";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  return {
    title: `People @${username} follows | Lost City`,
  };
}

export default async function FollowingPage({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();

  // Get profile
  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .eq("username", username)
    .single();

  if (!profileData) {
    notFound();
  }

  const profile = profileData as { id: string; username: string; display_name: string | null };

  // Get users they're following
  const { data: followsData } = await supabase
    .from("follows")
    .select(`
      followed_user:profiles!follows_followed_user_id_fkey(
        id, username, display_name, avatar_url, bio
      )
    `)
    .eq("follower_id", profile.id)
    .not("followed_user_id", "is", null)
    .order("created_at", { ascending: false });

  const following = (followsData || [])
    .map((f: { followed_user: unknown }) => f.followed_user)
    .filter(Boolean) as Array<{
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      bio: string | null;
    }>;

  // Also get venues they're following
  const { data: venueFollowsData } = await supabase
    .from("follows")
    .select(`
      venue:venues!follows_followed_venue_id_fkey(
        id, name, slug, neighborhood
      )
    `)
    .eq("follower_id", profile.id)
    .not("followed_venue_id", "is", null)
    .order("created_at", { ascending: false });

  const followedVenues = (venueFollowsData || [])
    .map((f: { venue: unknown }) => f.venue)
    .filter(Boolean) as Array<{
      id: number;
      name: string;
      slug: string;
      neighborhood: string | null;
    }>;

  return (
    <div className="min-h-screen">
      <PageHeader />

      {/* Main */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Link
            href={`/profile/${username}`}
            className="font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            &larr; Back to profile
          </Link>
        </div>

        <h1 className="font-serif text-xl text-[var(--cream)] italic mb-1">
          Following
        </h1>
        <p className="font-mono text-xs text-[var(--muted)] mb-6">
          People and places {profile.display_name || `@${profile.username}`} follows
        </p>

        {/* Users */}
        {following.length > 0 && (
          <section className="mb-8">
            <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">
              People
            </h2>
            <UserList users={following} emptyMessage="Not following anyone yet" />
          </section>
        )}

        {/* Venues */}
        {followedVenues.length > 0 && (
          <section>
            <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">
              Venues
            </h2>
            <div className="divide-y divide-[var(--twilight)]">
              {followedVenues.map((venue) => (
                <Link
                  key={venue.id}
                  href={`/spots/${venue.slug}`}
                  className="py-4 flex items-center gap-4 hover:bg-[var(--dusk)] -mx-4 px-4 transition-colors"
                >
                  <div className="w-12 h-12 rounded-lg bg-[var(--twilight)] flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm text-[var(--cream)]">
                      {venue.name}
                    </p>
                    {venue.neighborhood && (
                      <p className="font-mono text-xs text-[var(--muted)]">
                        {venue.neighborhood}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {following.length === 0 && followedVenues.length === 0 && (
          <p className="font-mono text-sm text-[var(--muted)] py-8 text-center">
            Not following anyone yet
          </p>
        )}
      </main>
    </div>
  );
}
