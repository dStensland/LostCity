"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import UserAvatar from "@/components/UserAvatar";
import { FriendSearch } from "@/components/community/FriendSearch";
import { PendingRequests } from "@/components/community/PendingRequests";
import { FriendsActivity } from "@/components/community/FriendsActivity";
import { FriendSuggestions } from "@/components/community/FriendSuggestions";
import { useFriends } from "@/lib/hooks/useFriends";
import { useFriendRequests } from "@/lib/hooks/useFriendRequests";

type TabType = "recommendations" | "activity";

export default function DashboardActivity() {
  const { user } = useAuth();

  const [showFriendsList, setShowFriendsList] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("activity");

  // Fetch data using TanStack Query hooks
  const { pendingRequests, isLoading: requestsLoading } = useFriendRequests({
    type: "received",
  });
  const { friends, isLoading: friendsLoading } = useFriends();

  // Combined loading state
  const loading = requestsLoading || friendsLoading;

  // For now, friend suggestions are empty - this can be added as a separate API endpoint later
  const friendSuggestions: never[] = [];

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!user) {
    return <UnauthenticatedView />;
  }

  return (
    <div className="space-y-6">
      {/* 1. Friend Search - Always at top */}
      <FriendSearch />

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
                  <div className="flex-shrink-0">
                    <UserAvatar
                      src={friend.avatar_url}
                      name={friend.display_name || friend.username}
                      size="sm"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-[var(--cream)] truncate group-hover:text-[var(--neon-cyan)] transition-colors">
                      {friend.display_name || `@${friend.username}`}
                    </span>
                    {friend.bio && (
                      <p className="text-xs text-[var(--muted)] line-clamp-2 sm:line-clamp-1">{friend.bio}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 3. Pending Friend Requests */}
      <PendingRequests requests={pendingRequests} />

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

        {activeTab === "recommendations" && (
          <FriendSuggestions suggestions={friendSuggestions} />
        )}

        {activeTab === "activity" && (
          <FriendsActivity />
        )}
      </section>
    </div>
  );
}

function LoadingSkeleton() {
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

function UnauthenticatedView() {
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
