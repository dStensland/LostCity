import { notFound } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import UserMenu from "@/components/UserMenu";
import UserList from "@/components/UserList";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  return {
    title: `People following @${username} | Lost City`,
  };
}

export default async function FollowersPage({ params }: Props) {
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

  // Get followers
  const { data: followsData } = await supabase
    .from("follows")
    .select(`
      follower:profiles!follows_follower_id_fkey(
        id, username, display_name, avatar_url, bio
      )
    `)
    .eq("followed_user_id", profile.id)
    .order("created_at", { ascending: false });

  const followers = (followsData || [])
    .map((f: { follower: unknown }) => f.follower)
    .filter(Boolean) as Array<{
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      bio: string | null;
    }>;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="px-4 sm:px-6 py-4 flex justify-between items-center border-b border-[var(--twilight)]">
        <div className="flex items-baseline gap-3">
          <Logo />
          <span className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest hidden sm:inline">
            Atlanta
          </span>
        </div>
        <nav className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className="font-mono text-[0.7rem] font-medium text-[var(--muted)] uppercase tracking-wide hover:text-[var(--cream)] transition-colors">
            Events
          </Link>
          <UserMenu />
        </nav>
      </header>

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
          Followers
        </h1>
        <p className="font-mono text-xs text-[var(--muted)] mb-6">
          People following {profile.display_name || `@${profile.username}`}
        </p>

        <UserList
          users={followers}
          emptyMessage="No followers yet"
        />
      </main>
    </div>
  );
}
