"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { useDebounce } from "@/lib/hooks/useDebounce";
import FriendButton from "@/components/FriendButton";
import FollowButton from "@/components/FollowButton";
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
  activity_type: "rsvp" | "recommendation" | "follow" | "save";
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
    note?: string;
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

export default function DashboardActivity() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [, setFriendSuggestions] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFriendsList, setShowFriendsList] = useState(false);

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
        // Take the first 3 suggestions if available
        setFriendSuggestions(data.suggestions?.slice(0, 3) || []);
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
    <div className="space-y-8">
      {/* People Search */}
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
                <div
                  key={profile.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)]"
                >
                  <Link href={`/profile/${profile.username}`} className="flex-shrink-0">
                    {profile.avatar_url ? (
                      <Image
                        src={profile.avatar_url}
                        alt={profile.display_name || profile.username}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[var(--coral)] flex items-center justify-center text-[var(--void)] font-bold text-sm">
                        {(profile.display_name || profile.username).charAt(0).toUpperCase()}
                      </div>
                    )}
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/profile/${profile.username}`}
                      className="font-medium text-[var(--cream)] hover:text-[var(--coral)] transition-colors block truncate"
                    >
                      {profile.display_name || `@${profile.username}`}
                    </Link>
                    <p className="text-xs text-[var(--muted)]">@{profile.username}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <FriendButton
                      targetUserId={profile.id}
                      targetUsername={profile.username}
                      size="sm"
                    />
                    <FollowButton targetUserId={profile.id} size="sm" />
                  </div>
                </div>
              ))
            ) : !searchLoading ? (
              <p className="text-center text-[var(--muted)] text-sm py-4">
                No people found for &ldquo;{searchQuery}&rdquo;
              </p>
            ) : null}
          </div>
        )}
      </section>

      {/* Pending Friend Requests */}
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
                    {otherUser.avatar_url ? (
                      <Image
                        src={otherUser.avatar_url}
                        alt={otherUser.display_name || otherUser.username}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[var(--coral)] flex items-center justify-center text-[var(--void)] font-bold text-sm">
                        {(otherUser.display_name || otherUser.username).charAt(0).toUpperCase()}
                      </div>
                    )}
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

      {/* Grouped Event Activity */}
      {groupedActivities.length > 0 && (
        <section>
          <h2 className="font-mono text-sm font-medium text-[var(--cream)] uppercase tracking-wider mb-4">
            Your Friends Are Going
          </h2>
          <div className="space-y-3">
            {groupedActivities.slice(0, 5).map((group) => (
              <GroupedEventCard key={group.event!.id} group={group} />
            ))}
          </div>
        </section>
      )}

      {/* Other Activity */}
      {otherActivities.length > 0 && (
        <section>
          <h2 className="font-mono text-sm font-medium text-[var(--cream)] uppercase tracking-wider mb-4">
            Recent Activity
          </h2>
          <div className="space-y-3">
            {otherActivities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {activities.length === 0 && pendingRequests.length === 0 && (
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

      {/* Friends Sidebar Toggle (Mobile) */}
      <div className="sm:hidden">
        <button
          onClick={() => setShowFriendsList(!showFriendsList)}
          className="w-full px-4 py-3 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg font-mono text-sm text-[var(--cream)] flex items-center justify-between"
        >
          <span>Your Friends ({friends.length})</span>
          <svg
            className={`w-5 h-5 transition-transform ${showFriendsList ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showFriendsList && (
          <div className="mt-3 p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
            <FriendsList friends={friends} />
          </div>
        )}
      </div>

      {/* Friends Sidebar (Desktop) */}
      <div className="hidden sm:block">
        <div className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
          <h3 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
            Your People ({friends.length})
          </h3>
          <FriendsList friends={friends} />
        </div>
      </div>
    </div>
  );
}

function GroupedEventCard({ group }: { group: GroupedActivity }) {
  const event = group.event!;
  const dateObj = parseISO(event.start_date);
  const formattedDate = format(dateObj, "EEE, MMM d");

  return (
    <Link
      href={`/events/${event.id}`}
      className="block p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg hover:border-[var(--coral)]/30 transition-all"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="flex -space-x-2">
          {group.users.slice(0, 4).map((user) => (
            <div
              key={user.id}
              className="w-8 h-8 rounded-full bg-[var(--coral)] flex items-center justify-center text-[var(--void)] text-xs font-bold border-2 border-[var(--dusk)]"
              title={user.display_name || `@${user.username}`}
            >
              {user.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt={user.display_name || user.username}
                  width={32}
                  height={32}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                (user.display_name || user.username).charAt(0).toUpperCase()
              )}
            </div>
          ))}
        </div>
        <span className="font-mono text-xs text-[var(--coral)]">
          {group.users.length === 1
            ? `${group.users[0].display_name || `@${group.users[0].username}`} is going`
            : `${group.users.length} friends going`}
        </span>
      </div>

      <h3 className="font-semibold text-[var(--cream)] line-clamp-1">
        {event.title}
      </h3>

      <p className="font-mono text-xs text-[var(--muted)] mt-1">
        {formattedDate}
        {event.venue && ` · ${event.venue.name}`}
      </p>
    </Link>
  );
}

function ActivityCard({ activity }: { activity: ActivityItem }) {
  const timeAgo = formatDistanceToNow(new Date(activity.created_at), { addSuffix: true });

  const getActivityText = () => {
    switch (activity.activity_type) {
      case "follow":
        return activity.target_user ? (
          <>
            started following{" "}
            <Link
              href={`/profile/${activity.target_user.username}`}
              className="font-medium text-[var(--cream)] hover:text-[var(--coral)]"
            >
              {activity.target_user.display_name || `@${activity.target_user.username}`}
            </Link>
          </>
        ) : activity.venue?.slug ? (
          <>
            started following{" "}
            <Link
              href={`/spots/${activity.venue.slug}`}
              className="font-medium text-[var(--cream)] hover:text-[var(--coral)]"
            >
              {activity.venue.name}
            </Link>
          </>
        ) : (
          "started following someone"
        );

      case "recommendation":
        return activity.event ? (
          <>
            recommended{" "}
            <Link
              href={`/events/${activity.event.id}`}
              className="font-medium text-[var(--cream)] hover:text-[var(--coral)]"
            >
              {activity.event.title}
            </Link>
          </>
        ) : activity.venue?.slug ? (
          <>
            recommended{" "}
            <Link
              href={`/spots/${activity.venue.slug}`}
              className="font-medium text-[var(--cream)] hover:text-[var(--coral)]"
            >
              {activity.venue.name}
            </Link>
          </>
        ) : (
          "recommended something"
        );

      case "save":
        return activity.event ? (
          <>
            saved{" "}
            <Link
              href={`/events/${activity.event.id}`}
              className="font-medium text-[var(--cream)] hover:text-[var(--coral)]"
            >
              {activity.event.title}
            </Link>
          </>
        ) : (
          "saved something"
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
      <div className="flex items-start gap-3">
        <Link href={`/profile/${activity.user.username}`} className="flex-shrink-0">
          {activity.user.avatar_url ? (
            <Image
              src={activity.user.avatar_url}
              alt={activity.user.display_name || activity.user.username}
              width={40}
              height={40}
              className="w-10 h-10 rounded-full object-cover border border-[var(--twilight)]"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[var(--coral)] flex items-center justify-center border border-[var(--twilight)]">
              <span className="font-mono text-sm font-bold text-[var(--void)]">
                {(activity.user.display_name || activity.user.username).charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </Link>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--soft)]">
            <Link
              href={`/profile/${activity.user.username}`}
              className="font-medium text-[var(--cream)] hover:text-[var(--coral)] transition-colors"
            >
              {activity.user.display_name || activity.user.username}
            </Link>{" "}
            {getActivityText()}
          </p>

          {activity.metadata?.note && (
            <p className="mt-2 text-sm text-[var(--muted)] italic">
              &ldquo;{activity.metadata.note}&rdquo;
            </p>
          )}

          <p className="mt-1 font-mono text-[0.65rem] text-[var(--muted)]">
            {timeAgo}
          </p>
        </div>
      </div>
    </div>
  );
}

function FriendsList({ friends }: { friends: Profile[] }) {
  if (friends.length === 0) {
    return (
      <p className="text-[var(--muted)] text-sm text-center py-4">
        Flying solo for now
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {friends.slice(0, 10).map((friend) => (
        <Link
          key={friend.id}
          href={`/profile/${friend.username}`}
          className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--twilight)]/30 transition-colors"
        >
          {friend.avatar_url ? (
            <Image
              src={friend.avatar_url}
              alt={friend.display_name || friend.username}
              width={32}
              height={32}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[var(--coral)] flex items-center justify-center text-[var(--void)] text-xs font-bold">
              {(friend.display_name || friend.username).charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <span className="block text-sm text-[var(--cream)] truncate">
              {friend.display_name || `@${friend.username}`}
            </span>
          </div>
        </Link>
      ))}
      {friends.length > 10 && (
        <Link
          href="/friends"
          className="block text-center text-xs font-mono text-[var(--coral)] hover:text-[var(--rose)] py-2"
        >
          View all {friends.length} friends
        </Link>
      )}
    </div>
  );
}
