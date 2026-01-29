"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import UserAvatar, { AvatarStack } from "@/components/UserAvatar";
import { useToast } from "@/components/Toast";
import { useDebounce } from "@/lib/hooks/useDebounce";
import FriendButton from "@/components/FriendButton";
import FollowButton from "@/components/FollowButton";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import { formatDistanceToNow, format, parseISO } from "date-fns";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type ActivityItem = {
  id: string;
  activity_type: "rsvp" | "follow" | "save";
  created_at: string;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  event?: {
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    is_all_day: boolean;
    category: string | null;
    image_url: string | null;
    venue?: { name: string } | null;
  } | null;
  venue?: {
    id: number;
    name: string;
    slug: string | null;
    neighborhood: string | null;
  } | null;
  target_user?: {
    id: string;
    username: string;
    display_name: string | null;
  } | null;
  metadata?: {
    status?: string;
  };
};

type GroupedActivity = {
  event: ActivityItem["event"];
  activities: ActivityItem[];
  users: ActivityItem["user"][];
};

type FriendRequest = {
  id: string;
  inviter_id: string;
  invitee_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  inviter?: Profile | null;
};

type TabType = "recommendations" | "activity";

export default function DashboardActivity() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [friendSuggestions, setFriendSuggestions] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFriendsList, setShowFriendsList] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("activity");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debouncedQuery = useDebounce(searchQuery, 300);

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Fetch all data in parallel
      const [activityRes, requestsRes, friendsRes] = await Promise.all([
        fetch("/api/dashboard/activity?limit=30"),
        fetch("/api/friend-requests?type=received"),
        fetch("/api/friends"),
      ]);

      if (activityRes.ok) {
        const data = await activityRes.json();
        setActivities(data.activities || []);
      }

      if (requestsRes.ok) {
        const data = await requestsRes.json();
        setPendingRequests(
          (data.requests || []).filter((r: FriendRequest) => r.status === "pending")
        );
      }

      if (friendsRes.ok) {
        const data = await friendsRes.json();
        setFriends(data.friends || []);
        // Take up to 10 suggestions if available
        setFriendSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error("Failed to fetch activity data:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Search for users
  const searchUsers = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.users || []);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    searchUsers(debouncedQuery);
  }, [debouncedQuery, searchUsers]);

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const res = await fetch(`/api/friend-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });

      if (res.ok) {
        showToast("Friend request accepted!");
        fetchData();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to accept", "error");
      }
    } catch {
      showToast("Failed to accept request", "error");
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      const res = await fetch(`/api/friend-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      });

      if (res.ok) {
        showToast("Request declined");
        fetchData();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to decline", "error");
      }
    } catch {
      showToast("Failed to decline request", "error");
    }
  };

  // Group activities by event
  const groupedActivities = activities.reduce<GroupedActivity[]>((acc, activity) => {
    if (activity.activity_type === "rsvp" && activity.event) {
      const existing = acc.find((g) => g.event?.id === activity.event?.id);
      if (existing) {
        existing.activities.push(activity);
        if (!existing.users.find((u) => u.id === activity.user.id)) {
          existing.users.push(activity.user);
        }
      } else {
        acc.push({
          event: activity.event,
          activities: [activity],
          users: [activity.user],
        });
      }
    }
    return acc;
  }, []);

  // Non-event activities (follows, recommendations)
  const otherActivities = activities.filter(
    (a) => a.activity_type !== "rsvp" || !a.event
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Friend requests skeleton */}
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 skeleton-shimmer rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 skeleton-shimmer rounded w-32" />
                  <div className="h-3 skeleton-shimmer rounded w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Activity skeleton */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 skeleton-shimmer rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 skeleton-shimmer rounded w-3/4" />
                  <div className="h-3 skeleton-shimmer rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        {/* Hero section */}
        <div className="p-6 rounded-xl bg-gradient-to-br from-[var(--dusk)] to-[var(--night)] border border-[var(--twilight)] text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--neon-cyan)]/20 to-[var(--neon-magenta)]/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--neon-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="font-serif text-xl text-[var(--cream)] mb-2">
            See What Your Friends Are Doing
          </h3>
          <p className="text-sm text-[var(--muted)] mb-5 max-w-sm mx-auto">
            Connect with friends, see where they&apos;re going, and discover events through the people you trust.
          </p>
          <Link
            href="/auth/login?redirect=/atl?view=community"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
          >
            Sign In to Connect
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>

        {/* Blurred fake activity preview */}
        <div className="relative">
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <span className="px-3 py-1.5 rounded-full bg-[var(--void)]/80 border border-[var(--twilight)] font-mono text-xs text-[var(--muted)]">
              Sign in to see activity
            </span>
          </div>
          <div className="space-y-3 blur-sm opacity-60 select-none" aria-hidden="true">
            {/* Fake friend request */}
            <div className="flex items-center gap-4 p-4 bg-[var(--dusk)] border border-[var(--coral)]/30 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-[var(--coral)]" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-[var(--twilight)] rounded" />
                <div className="h-3 w-20 bg-[var(--twilight)] rounded mt-1" />
              </div>
              <div className="flex gap-2">
                <div className="px-3 py-1.5 bg-[var(--coral)] rounded-lg h-8 w-16" />
                <div className="px-3 py-1.5 bg-[var(--twilight)] rounded-lg h-8 w-16" />
              </div>
            </div>

            {/* Fake grouped activity */}
            <div className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full bg-[var(--neon-cyan)] border-2 border-[var(--dusk)]" />
                  <div className="w-8 h-8 rounded-full bg-[var(--coral)] border-2 border-[var(--dusk)]" />
                </div>
                <div className="h-3 w-24 bg-[var(--neon-cyan)]/30 rounded" />
              </div>
              <div className="h-5 w-48 bg-[var(--twilight)] rounded" />
              <div className="h-3 w-32 bg-[var(--twilight)] rounded mt-2" />
            </div>

            {/* Fake activity items */}
            {[1, 2].map((i) => (
              <div key={i} className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--twilight)]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-[var(--twilight)] rounded" />
                    <div className="h-3 w-16 bg-[var(--twilight)] rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Friend Search - Always at top */}
      <section>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Find your people"
            className="w-full px-4 py-3 pl-11 rounded-xl bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--coral)]/50 focus:ring-1 focus:ring-[var(--coral)]/20 transition-all"
          />
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchLoading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Search Results */}
        {searchQuery.length >= 2 && (
          <div className="mt-3 space-y-2">
            {searchResults.length > 0 ? (
              searchResults.map((profile) => (
                <UserCard key={profile.id} profile={profile} />
              ))
            ) : !searchLoading ? (
              <p className="text-center text-[var(--muted)] text-sm py-4">
                No people found for &ldquo;{searchQuery}&rdquo;
              </p>
            ) : null}
          </div>
        )}
      </section>

      {/* 2. Friend List - Collapsible, default collapsed */}
      {friends.length > 0 && (
        <section>
          <button
            onClick={() => setShowFriendsList(!showFriendsList)}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] hover:border-[var(--coral)]/30 transition-all"
          >
            <span className="font-mono text-sm font-medium text-[var(--cream)] uppercase tracking-wider">
              Your Friends ({friends.length})
            </span>
            <svg
              className={`w-5 h-5 text-[var(--muted)] transition-transform ${showFriendsList ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showFriendsList && (
            <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
              {friends.map((friend) => (
                <Link
                  key={friend.id}
                  href={`/profile/${friend.username}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] hover:border-[var(--neon-cyan)]/30 transition-all group"
                >
                  <UserAvatar
                    src={friend.avatar_url}
                    name={friend.display_name || friend.username}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-[var(--cream)] truncate group-hover:text-[var(--neon-cyan)] transition-colors">
                      {friend.display_name || `@${friend.username}`}
                    </span>
                    {friend.bio && (
                      <p className="text-xs text-[var(--muted)] truncate">{friend.bio}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 3. Pending Friend Requests - Always visible if any exist */}
      {pendingRequests.length > 0 && (
        <section>
          <h2 className="font-mono text-sm font-medium text-[var(--cream)] uppercase tracking-wider mb-4">
            Friend Requests ({pendingRequests.length})
          </h2>
          <div className="space-y-3">
            {pendingRequests.map((request) => {
              const otherUser = request.inviter;
              if (!otherUser) return null;

              return (
                <div
                  key={request.id}
                  className="flex items-center gap-4 p-4 bg-[var(--dusk)] border border-[var(--coral)]/30 rounded-lg"
                >
                  <Link href={`/profile/${otherUser.username}`}>
                    <UserAvatar
                      src={otherUser.avatar_url}
                      name={otherUser.display_name || otherUser.username}
                      size="md"
                      glow
                    />
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/profile/${otherUser.username}`}
                      className="font-medium text-[var(--cream)] hover:text-[var(--coral)] transition-colors block truncate"
                    >
                      {otherUser.display_name || `@${otherUser.username}`}
                    </Link>
                    <p className="text-xs text-[var(--muted)]">
                      {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAcceptRequest(request.id)}
                      className="px-3 py-1.5 bg-[var(--coral)] text-[var(--void)] rounded-lg text-xs font-mono font-medium hover:bg-[var(--rose)] transition-colors min-h-[36px]"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDeclineRequest(request.id)}
                      className="px-3 py-1.5 bg-transparent border border-[var(--muted)] text-[var(--muted)] rounded-lg text-xs font-mono font-medium hover:bg-[var(--muted)]/10 transition-colors min-h-[36px]"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. Tabs: Recommendations | Activity */}
      <section>
        <div className="flex gap-2 border-b border-[var(--twilight)] mb-4">
          <button
            onClick={() => setActiveTab("recommendations")}
            className={`px-4 py-2 font-mono text-sm font-medium transition-all ${
              activeTab === "recommendations"
                ? "text-[var(--neon-cyan)] border-b-2 border-[var(--neon-cyan)]"
                : "text-[var(--muted)] hover:text-[var(--soft)]"
            }`}
          >
            Recommendations
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={`px-4 py-2 font-mono text-sm font-medium transition-all ${
              activeTab === "activity"
                ? "text-[var(--neon-cyan)] border-b-2 border-[var(--neon-cyan)]"
                : "text-[var(--muted)] hover:text-[var(--soft)]"
            }`}
          >
            Activity
          </button>
        </div>

        {/* Recommendations Tab */}
        {activeTab === "recommendations" && (
          <div className="space-y-3">
            {friendSuggestions.length > 0 ? (
              <>
                <h3 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
                  People You May Know
                </h3>
                {friendSuggestions.map((profile) => (
                  <UserCard key={profile.id} profile={profile} />
                ))}
              </>
            ) : (
              <div className="p-6 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg text-center">
                <svg
                  className="w-12 h-12 mx-auto mb-3 text-[var(--muted)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <p className="text-[var(--soft)] font-mono text-sm">
                  No recommendations yet
                </p>
                <p className="text-[var(--muted)] font-mono text-xs mt-1">
                  Connect with more people to see suggestions
                </p>
              </div>
            )}
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === "activity" && (
          <div className="space-y-4">
            {/* Grouped Event Activity */}
            {groupedActivities.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
                  Friends Are Going
                </h3>
                {groupedActivities.slice(0, 5).map((group) => (
                  <GroupedEventCard key={group.event!.id} group={group} />
                ))}
              </div>
            )}

            {/* Other Activity */}
            {otherActivities.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
                  What Friends Are Into
                </h3>
                {otherActivities.map((activity) => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))}
              </div>
            )}

            {/* Empty State */}
            {activities.length === 0 && (
              <div className="p-6 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg text-center">
                <svg
                  className="w-12 h-12 mx-auto mb-3 text-[var(--muted)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <p className="text-[var(--soft)] font-mono text-sm">
                  Your friends are suspiciously quiet.
                </p>
                <p className="text-[var(--muted)] font-mono text-xs mt-1">
                  Follow more people to see their activity here
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// UserCard component - for recommendations and search results
function UserCard({ profile }: { profile: Profile }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] hover:border-[var(--neon-cyan)]/30 transition-all group">
      <Link href={`/profile/${profile.username}`} className="flex-shrink-0">
        <UserAvatar
          src={profile.avatar_url}
          name={profile.display_name || profile.username}
          size="md"
          glow
        />
      </Link>

      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${profile.username}`}
          className="font-medium text-[var(--cream)] hover:text-[var(--neon-cyan)] transition-colors block truncate"
        >
          {profile.display_name || `@${profile.username}`}
        </Link>
        <p className="text-xs text-[var(--muted)] truncate">@{profile.username}</p>
        {profile.bio && (
          <p className="text-xs text-[var(--soft)] mt-0.5 line-clamp-1">{profile.bio}</p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <FriendButton
          targetUserId={profile.id}
          targetUsername={profile.username}
          size="sm"
        />
        <FollowButton targetUserId={profile.id} size="sm" />
      </div>
    </div>
  );
}

// GroupedEventCard - styled like EventCard
function GroupedEventCard({ group }: { group: GroupedActivity }) {
  const event = group.event!;
  const dateObj = parseISO(event.start_date);
  const categoryColor = event.category ? getCategoryColor(event.category) : null;

  // Format time
  const timeStr = event.is_all_day
    ? "All Day"
    : event.start_time
      ? format(parseISO(`2000-01-01T${event.start_time}`), "h:mm a")
      : "";

  const dayLabel = format(dateObj, "EEE");
  const dateLabel = format(dateObj, "MMM d");

  return (
    <Link
      href={`/events/${event.id}`}
      className="block p-3 rounded-lg border border-[var(--twilight)] bg-[var(--dusk)] hover:border-[var(--neon-cyan)]/30 transition-all group"
      style={{
        borderLeftWidth: categoryColor ? "3px" : undefined,
        borderLeftColor: categoryColor || undefined,
      }}
    >
      <div className="flex gap-3">
        {/* Time cell - like EventCard */}
        <div className="flex-shrink-0 w-14 flex flex-col items-center justify-center py-1">
          <span className="font-mono text-[0.55rem] font-medium leading-none text-[var(--muted)]">
            {dayLabel}
          </span>
          <span className="font-mono text-sm font-medium text-[var(--soft)] leading-none tabular-nums mt-0.5">
            {dateLabel}
          </span>
          {timeStr && (
            <span className="font-mono text-[0.55rem] text-[var(--muted)] mt-0.5">{timeStr}</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Category icon + title */}
          <div className="flex items-center gap-2 mb-1">
            {event.category && (
              <span
                className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded"
                style={{
                  backgroundColor: categoryColor ? `${categoryColor}20` : undefined,
                }}
              >
                <CategoryIcon type={event.category} size={12} glow="subtle" />
              </span>
            )}
            <h3 className="text-[var(--cream)] font-medium leading-snug line-clamp-1 group-hover:text-[var(--neon-cyan)] transition-colors">
              {event.title}
            </h3>
          </div>

          {/* Friend avatars */}
          <div className="flex items-center gap-2 mb-1">
            <AvatarStack
              users={group.users.map((u) => ({
                id: u.id,
                name: u.display_name || u.username,
                avatar_url: u.avatar_url,
              }))}
              max={4}
              size="xs"
            />
            <span className="font-mono text-xs text-[var(--neon-cyan)]">
              {group.users.length === 1
                ? `${group.users[0].display_name || group.users[0].username} is going`
                : `${group.users.length} friends going`}
            </span>
          </div>

          {/* Venue details */}
          {event.venue && (
            <p className="font-mono text-xs text-[var(--muted)]">
              {event.venue.name}
            </p>
          )}
        </div>

        {/* Thumbnail if available */}
        {event.image_url && (
          <div
            className="hidden sm:block flex-shrink-0 w-16 h-16 rounded-lg border border-[var(--twilight)] bg-cover bg-center"
            style={{ backgroundImage: `url(${event.image_url})` }}
          />
        )}
      </div>
    </Link>
  );
}

// ActivityCard - styled like EventCard for event activities
function ActivityCard({ activity }: { activity: ActivityItem }) {
  const timeAgo = formatDistanceToNow(new Date(activity.created_at), { addSuffix: true });

  // Render saved/RSVP event activity - styled like EventCard
  if ((activity.activity_type === "save" || activity.activity_type === "rsvp") && activity.event) {
    const eventDate = parseISO(activity.event.start_date);
    const categoryColor = activity.event.category ? getCategoryColor(activity.event.category) : null;

    // Format time
    const timeStr = activity.event.is_all_day
      ? "All Day"
      : activity.event.start_time
        ? format(parseISO(`2000-01-01T${activity.event.start_time}`), "h:mm a")
        : "";

    const dayLabel = format(eventDate, "EEE");
    const dateLabel = format(eventDate, "MMM d");

    return (
      <Link
        href={`/events/${activity.event.id}`}
        className="block p-3 rounded-lg border border-[var(--twilight)] bg-[var(--dusk)] hover:border-[var(--neon-magenta)]/30 transition-all group"
        style={{
          borderLeftWidth: categoryColor ? "3px" : undefined,
          borderLeftColor: categoryColor || undefined,
        }}
      >
        <div className="flex gap-3">
          {/* Time cell - like EventCard */}
          <div className="flex-shrink-0 w-14 flex flex-col items-center justify-center py-1">
            <span className="font-mono text-[0.55rem] font-medium leading-none text-[var(--muted)]">
              {dayLabel}
            </span>
            <span className="font-mono text-sm font-medium text-[var(--soft)] leading-none tabular-nums mt-0.5">
              {dateLabel}
            </span>
            {timeStr && (
              <span className="font-mono text-[0.55rem] text-[var(--muted)] mt-0.5">{timeStr}</span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* User action header */}
            <div className="flex items-center gap-2 mb-1">
              <UserAvatar
                src={activity.user.avatar_url}
                name={activity.user.display_name || activity.user.username}
                size="xs"
              />
              <span className="text-xs text-[var(--muted)] truncate">
                <span className="text-[var(--soft)]">
                  {activity.user.display_name || activity.user.username}
                </span>
                {" "}{activity.activity_type === "save" ? "saved" : "is interested in"} this
              </span>
              <span className="ml-auto font-mono text-[0.55rem] text-[var(--muted)] flex-shrink-0">
                {timeAgo}
              </span>
            </div>

            {/* Category icon + title */}
            <div className="flex items-center gap-2 mb-1">
              {activity.event.category && (
                <span
                  className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded"
                  style={{
                    backgroundColor: categoryColor ? `${categoryColor}20` : undefined,
                  }}
                >
                  <CategoryIcon type={activity.event.category} size={12} glow="subtle" />
                </span>
              )}
              <h3 className="text-[var(--cream)] font-medium leading-snug line-clamp-1 group-hover:text-[var(--neon-magenta)] transition-colors">
                {activity.event.title}
              </h3>
            </div>

            {/* Venue details */}
            {activity.event.venue && (
              <p className="font-mono text-xs text-[var(--muted)]">
                {activity.event.venue.name}
              </p>
            )}
          </div>

          {/* Thumbnail if available */}
          {activity.event.image_url && (
            <div
              className="hidden sm:block flex-shrink-0 w-16 h-16 rounded-lg border border-[var(--twilight)] bg-cover bg-center"
              style={{ backgroundImage: `url(${activity.event.image_url})` }}
            />
          )}
        </div>
      </Link>
    );
  }

  // Render venue follow activity - simpler card
  if (activity.activity_type === "follow" && activity.venue?.slug) {
    return (
      <Link
        href={`/spots/${activity.venue.slug}`}
        className="block p-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] hover:border-[var(--neon-cyan)]/30 transition-all group"
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <UserAvatar
            src={activity.user.avatar_url}
            name={activity.user.display_name || activity.user.username}
            size="xs"
          />
          <span className="text-xs text-[var(--muted)]">
            <span className="text-[var(--soft)]">
              {activity.user.display_name || activity.user.username}
            </span>
            {" "}now follows
          </span>
          <span className="ml-auto font-mono text-[0.55rem] text-[var(--muted)]">
            {timeAgo}
          </span>
        </div>

        {/* Venue info */}
        <h4 className="font-medium text-[var(--cream)] group-hover:text-[var(--neon-cyan)] transition-colors">
          {activity.venue.name}
        </h4>
        {activity.venue.neighborhood && (
          <p className="font-mono text-xs text-[var(--muted)] mt-0.5">
            {activity.venue.neighborhood}
          </p>
        )}
      </Link>
    );
  }

  // Render user follow activity - simpler card
  if (activity.activity_type === "follow" && activity.target_user) {
    return (
      <div className="p-3 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <UserAvatar
            src={activity.user.avatar_url}
            name={activity.user.display_name || activity.user.username}
            size="xs"
          />
          <span className="text-xs text-[var(--muted)]">
            <span className="text-[var(--soft)]">
              {activity.user.display_name || activity.user.username}
            </span>
            {" "}followed
          </span>
          <span className="ml-auto font-mono text-[0.55rem] text-[var(--muted)]">
            {timeAgo}
          </span>
        </div>

        {/* Target user card */}
        <div className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-[var(--twilight)]/20 transition-colors">
          <Link href={`/profile/${activity.target_user.username}`}>
            <UserAvatar
              src={null}
              name={activity.target_user.display_name || activity.target_user.username}
              size="md"
              glow
            />
          </Link>
          <div className="flex-1 min-w-0">
            <Link
              href={`/profile/${activity.target_user.username}`}
              className="font-medium text-[var(--cream)] hover:text-[var(--neon-cyan)] transition-colors block truncate"
            >
              {activity.target_user.display_name || `@${activity.target_user.username}`}
            </Link>
            <p className="text-xs text-[var(--muted)]">@{activity.target_user.username}</p>
          </div>
          <FollowButton targetUserId={activity.target_user.id} size="sm" />
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}

