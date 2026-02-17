import { notFound } from "next/navigation";
import UnifiedHeader from "@/components/UnifiedHeader";
import PageFooter from "@/components/PageFooter";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileTabsClient from "./ProfileTabsClient";
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
    .maybeSingle();

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

  // Get current user for relationship checks
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  // Get profile
  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();

  const profile = profileData as Profile | null;

  if (!profile) {
    notFound();
  }

  const isOwnProfile = currentUser?.id === profile.id;

  // Check privacy
  if (!profile.is_public && !isOwnProfile) {
    return (
      <div className="min-h-screen">
        <UnifiedHeader />
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
            <svg className="w-10 h-10 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-[var(--cream)] mb-2">This profile is private</h1>
          <p className="font-mono text-sm text-[var(--muted)]">@{username} has chosen to keep their profile private.</p>
        </div>
        <PageFooter />
      </div>
    );
  }

  // Fetch all data in parallel
  const [
    { count: followerCount },
    { count: followingCount },
    { count: eventsAttended },
    { data: followData },
    { data: friendData },
    { data: activityData },
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
    // Check if current user follows this profile
    currentUser
      ? supabase
          .from("follows")
          .select("id")
          .eq("follower_id", currentUser.id)
          .eq("followed_user_id", profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // Check friend relationship
    currentUser
      ? supabase
          .from("follows")
          .select("id")
          .eq("follower_id", profile.id)
          .eq("followed_user_id", currentUser.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // Activity feed
    supabase
      .from("activities")
      .select(
        `
      *,
      event:events(id, title, start_date),
      venue:venues(id, name, slug)
    `
      )
      .eq("user_id", profile.id)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const iFollow = !!followData;
  const theyFollowMe = !!friendData;
  const initialRelationship: "none" | "friends" | "following" | "followed_by" =
    iFollow && theyFollowMe
      ? "friends"
      : iFollow
        ? "following"
        : theyFollowMe
          ? "followed_by"
          : "none";

  const recentActivity = (activityData || []) as Activity[];

  return (
    <div className="min-h-screen">
      <UnifiedHeader />

      <ProfileHeader
        profile={{
          id: profile.id,
          username: profile.username,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          bio: profile.bio,
          location: profile.location,
          website: profile.website,
          created_at: profile.created_at,
        }}
        isOwnProfile={isOwnProfile}
        followerCount={followerCount ?? 0}
        followingCount={followingCount ?? 0}
        eventsAttended={eventsAttended ?? 0}
        initialRelationship={initialRelationship}
      />

      <ProfileTabsClient
        username={profile.username}
        initialActivities={recentActivity.map((a) => ({
          id: a.id,
          activity_type: a.activity_type,
          metadata: a.metadata as Record<string, unknown> | null,
          created_at: a.created_at,
          event: a.event,
          venue: a.venue,
        }))}
      />

      <PageFooter />
    </div>
  );
}
