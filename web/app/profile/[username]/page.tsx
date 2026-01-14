import { notFound } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import UserMenu from "@/components/UserMenu";
import FollowButton from "@/components/FollowButton";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Activity = Database["public"]["Tables"]["activities"]["Row"] & {
  event?: { id: number; title: string; start_date: string } | null;
  venue?: { id: number; name: string; slug: string } | null;
};

type Props = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("username", username)
    .single();

  const profile = data as Pick<Profile, "display_name" | "username"> | null;

  if (!profile) {
    return { title: "Profile Not Found | Lost City" };
  }

  return {
    title: `${profile.display_name || `@${profile.username}`} | Lost City`,
  };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const supabase = await createClient();

  // Get profile
  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();

  const profile = profileData as Profile | null;

  if (!profile) {
    notFound();
  }

  // Get follower/following counts
  const [
    { count: followerCount },
    { count: followingCount },
  ] = await Promise.all([
    supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("followed_user_id", profile.id),
    supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("follower_id", profile.id),
  ]);

  // Get recent activity (public only for now)
  const { data: activityData } = await supabase
    .from("activities")
    .select(`
      *,
      event:events(id, title, start_date),
      venue:venues(id, name, slug)
    `)
    .eq("user_id", profile.id)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(10);

  const recentActivity = (activityData || []) as Activity[];

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

      {/* Profile Header */}
      <section className="max-w-3xl mx-auto px-4 py-8 border-b border-[var(--twilight)]">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name || profile.username}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-[var(--twilight)]"
            />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[var(--coral)] flex items-center justify-center flex-shrink-0">
              <span className="font-mono text-2xl font-bold text-[var(--void)]">
                {profile.display_name
                  ? profile.display_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                  : profile.username.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-serif text-2xl text-[var(--cream)] italic truncate">
                  {profile.display_name || profile.username}
                </h1>
                <p className="font-mono text-sm text-[var(--muted)]">
                  @{profile.username}
                </p>
              </div>
              <FollowButton targetUserId={profile.id} />
            </div>

            {profile.bio && (
              <p className="mt-3 text-[var(--soft)] text-sm">
                {profile.bio}
              </p>
            )}

            {/* Stats */}
            <div className="flex gap-6 mt-4">
              <Link
                href={`/profile/${profile.username}/followers`}
                className="hover:text-[var(--coral)] transition-colors"
              >
                <span className="font-mono text-sm text-[var(--cream)]">
                  {followerCount || 0}
                </span>
                <span className="font-mono text-xs text-[var(--muted)] ml-1">
                  followers
                </span>
              </Link>
              <Link
                href={`/profile/${profile.username}/following`}
                className="hover:text-[var(--coral)] transition-colors"
              >
                <span className="font-mono text-sm text-[var(--cream)]">
                  {followingCount || 0}
                </span>
                <span className="font-mono text-xs text-[var(--muted)] ml-1">
                  following
                </span>
              </Link>
            </div>

            {/* Location & Website */}
            <div className="flex flex-wrap gap-4 mt-3">
              {profile.location && (
                <span className="font-mono text-xs text-[var(--muted)] flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {profile.location}
                </span>
              )}
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-[var(--coral)] hover:text-[var(--rose)] flex items-center gap-1 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  {profile.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Activity Feed */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">
          Recent Activity
        </h2>

        {recentActivity.length > 0 ? (
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        ) : (
          <p className="font-mono text-sm text-[var(--muted)] py-8 text-center">
            No public activity yet
          </p>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--twilight)] bg-[var(--night)]">
        <div className="max-w-3xl mx-auto px-4 py-8 text-center">
          <Logo size="md" href="/" />
          <p className="font-serif text-[var(--muted)] mt-1">
            The real Atlanta, found
          </p>
        </div>
      </footer>
    </div>
  );
}

function ActivityItem({ activity }: { activity: any }) {
  const getActivityText = () => {
    switch (activity.activity_type) {
      case "rsvp":
        const status = activity.metadata?.status;
        return (
          <>
            {status === "going" ? "is going to" : status === "interested" ? "is interested in" : "went to"}{" "}
            {activity.event && (
              <Link href={`/events/${activity.event.id}`} className="text-[var(--coral)] hover:text-[var(--rose)]">
                {activity.event.title}
              </Link>
            )}
          </>
        );
      case "recommendation":
        return (
          <>
            recommends{" "}
            {activity.event && (
              <Link href={`/events/${activity.event.id}`} className="text-[var(--coral)] hover:text-[var(--rose)]">
                {activity.event.title}
              </Link>
            )}
            {activity.venue && (
              <Link href={`/spots/${activity.venue.slug}`} className="text-[var(--coral)] hover:text-[var(--rose)]">
                {activity.venue.name}
              </Link>
            )}
            {activity.metadata?.note && (
              <span className="block mt-1 text-[var(--soft)] italic">
                &ldquo;{activity.metadata.note}&rdquo;
              </span>
            )}
          </>
        );
      case "follow_venue":
        return (
          <>
            started following{" "}
            {activity.venue && (
              <Link href={`/spots/${activity.venue.slug}`} className="text-[var(--coral)] hover:text-[var(--rose)]">
                {activity.venue.name}
              </Link>
            )}
          </>
        );
      default:
        return activity.activity_type;
    }
  };

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="flex gap-3 py-3 border-b border-[var(--twilight)]">
      <div className="w-2 h-2 rounded-full bg-[var(--coral)] mt-2 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-mono text-sm text-[var(--cream)]">
          {getActivityText()}
        </p>
        <p className="font-mono text-xs text-[var(--muted)] mt-1">
          {timeAgo(activity.created_at)}
        </p>
      </div>
    </div>
  );
}
