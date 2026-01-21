import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import FollowButton from "@/components/FollowButton";
import FriendButton from "@/components/FriendButton";
import { createClient } from "@/lib/supabase/server";
import { formatDistanceToNow, format } from "date-fns";
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

  // Get follower/following counts and activity stats
  const [
    { count: followerCount },
    { count: followingCount },
    { count: eventsAttended },
    { count: recommendationsMade },
  ] = await Promise.all([
    supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("followed_user_id", profile.id),
    supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("follower_id", profile.id),
    supabase
      .from("event_rsvps")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("status", "going"),
    supabase
      .from("recommendations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id),
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
      <PageHeader />

      {/* Profile Header */}
      <section className="max-w-3xl mx-auto px-4 py-8 border-b border-[var(--twilight)]">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={profile.display_name || profile.username}
              width={96}
              height={96}
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
              <div className="flex items-center gap-2">
                <FriendButton targetUserId={profile.id} targetUsername={profile.username} />
                <FollowButton targetUserId={profile.id} />
              </div>
            </div>

            {profile.bio && (
              <p className="mt-3 text-[var(--soft)] text-sm">
                {profile.bio}
              </p>
            )}

            {/* Stats */}
            <div className="flex flex-wrap gap-4 sm:gap-6 mt-4">
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
              {(eventsAttended ?? 0) > 0 && (
                <div>
                  <span className="font-mono text-sm text-[var(--cream)]">
                    {eventsAttended}
                  </span>
                  <span className="font-mono text-xs text-[var(--muted)] ml-1">
                    events
                  </span>
                </div>
              )}
              {(recommendationsMade ?? 0) > 0 && (
                <div>
                  <span className="font-mono text-sm text-[var(--cream)]">
                    {recommendationsMade}
                  </span>
                  <span className="font-mono text-xs text-[var(--muted)] ml-1">
                    recs
                  </span>
                </div>
              )}
            </div>

            {/* Location, Website & Member since */}
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
              <span className="font-mono text-xs text-[var(--muted)] flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Joined {format(new Date(profile.created_at), "MMM yyyy")}
              </span>
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
          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="font-mono text-sm text-[var(--muted)]">
              No public activity yet
            </p>
          </div>
        )}
      </main>

      <PageFooter />
    </div>
  );
}

function ActivityItem({ activity }: { activity: Activity }) {
  const metadata = activity.metadata as { status?: string; note?: string } | null;

  const getActivityIcon = () => {
    switch (activity.activity_type) {
      case "rsvp": {
        const status = metadata?.status;
        if (status === "going") {
          return (
            <div className="w-8 h-8 rounded-full bg-[var(--cat-community)]/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-[var(--cat-community)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          );
        }
        return (
          <div className="w-8 h-8 rounded-full bg-[var(--gold)]/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-[var(--gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
        );
      }
      case "recommendation":
        return (
          <div className="w-8 h-8 rounded-full bg-[var(--coral)]/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
        );
      case "follow_venue":
        return (
          <div className="w-8 h-8 rounded-full bg-[#A78BFA]/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-[#A78BFA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-[var(--twilight)] flex items-center justify-center flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-[var(--muted)]" />
          </div>
        );
    }
  };

  const getActivityText = () => {
    switch (activity.activity_type) {
      case "rsvp": {
        const status = metadata?.status;
        return (
          <>
            {status === "going" ? "Going to" : status === "interested" ? "Interested in" : "Went to"}{" "}
            {activity.event && (
              <Link href={`/events/${activity.event.id}`} className="text-[var(--coral)] hover:text-[var(--rose)] font-medium">
                {activity.event.title}
              </Link>
            )}
          </>
        );
      }
      case "recommendation":
        return (
          <>
            Recommends{" "}
            {activity.event && (
              <Link href={`/events/${activity.event.id}`} className="text-[var(--coral)] hover:text-[var(--rose)] font-medium">
                {activity.event.title}
              </Link>
            )}
            {activity.venue && (
              <Link href={`/spots/${activity.venue.slug}`} className="text-[var(--coral)] hover:text-[var(--rose)] font-medium">
                {activity.venue.name}
              </Link>
            )}
            {metadata?.note && (
              <span className="block mt-2 text-[var(--soft)] italic text-sm pl-2 border-l-2 border-[var(--twilight)]">
                &ldquo;{metadata.note}&rdquo;
              </span>
            )}
          </>
        );
      case "follow_venue":
        return (
          <>
            Started following{" "}
            {activity.venue && (
              <Link href={`/spots/${activity.venue.slug}`} className="text-[var(--coral)] hover:text-[var(--rose)] font-medium">
                {activity.venue.name}
              </Link>
            )}
          </>
        );
      default:
        return activity.activity_type;
    }
  };

  return (
    <div className="flex gap-3 p-3 rounded-lg border border-[var(--twilight)] card-event-hover" style={{ backgroundColor: "var(--card-bg)" }}>
      {getActivityIcon()}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--cream)]">
          {getActivityText()}
        </p>
        <p className="font-mono text-xs text-[var(--muted)] mt-1">
          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}
