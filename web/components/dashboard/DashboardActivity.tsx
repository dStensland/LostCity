"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { FriendSearch } from "@/components/community/FriendSearch";
import { PendingRequests } from "@/components/community/PendingRequests";
import { FriendsActivity } from "@/components/community/FriendsActivity";
import { FriendSuggestions } from "@/components/community/FriendSuggestions";
import { useFriendRequests } from "@/lib/hooks/useFriendRequests";

export default function DashboardActivity() {
  const { user } = useAuth();

  // Fetch data using TanStack Query hooks
  const { pendingRequests, isLoading: requestsLoading } = useFriendRequests({
    type: "received",
  });

  // Loading state
  const loading = requestsLoading;

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
      {/* 1. Enhanced Search - Glass style */}
      <FriendSearch />

      {/* 2. Friend Suggestions - Inline, auto-shown if any exist */}
      {friendSuggestions.length > 0 && (
        <FriendSuggestions suggestions={friendSuggestions} isLoading={false} />
      )}

      {/* 3. Pending Friend Requests - Always visible when present */}
      <PendingRequests requests={pendingRequests} />

      {/* 4. Activity Feed - Primary content */}
      <FriendsActivity />
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
      {/* Hero section with glass effect and aurora background */}
      <div className="relative overflow-hidden">
        {/* Aurora ambient background pools */}
        <div
          className="absolute top-0 left-1/4 w-64 h-64 rounded-full blur-[120px] opacity-20 pointer-events-none"
          style={{
            background: "radial-gradient(circle, var(--coral) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full blur-[120px] opacity-15 pointer-events-none"
          style={{
            background: "radial-gradient(circle, var(--neon-magenta) 0%, transparent 70%)",
          }}
        />

        {/* Glass card */}
        <div className="relative glass p-6 rounded-xl text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--coral)]/20 to-[var(--neon-magenta)]/20 flex items-center justify-center animate-float">
            <svg className="w-8 h-8 text-[var(--coral)] animate-pulse-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="font-serif text-xl text-[var(--cream)] mb-2 animate-stagger-1">
            Your people are out there
          </h3>
          <p className="text-sm text-[var(--muted)] mb-5 max-w-sm mx-auto animate-stagger-2">
            See what they&apos;re up to and never miss the vibes. Connect with friends and discover events through the people you trust.
          </p>
          <Link
            href="/auth/login?redirect=/atl?view=community"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-all hover:scale-105 shadow-lg shadow-[var(--coral)]/20 animate-stagger-3"
          >
            Sign In to Connect
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Enhanced blurred preview with glass cards and coral accent glow */}
      <div className="relative">
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <span className="px-3 py-1.5 rounded-full glass border border-[var(--twilight)] font-mono text-xs text-[var(--muted)]">
            Sign in to see activity
          </span>
        </div>
        <div className="space-y-3 blur-sm opacity-60 select-none" aria-hidden="true">
          {/* Fake friend request - glass card */}
          <div className="flex items-center gap-4 p-4 glass border border-[var(--coral)]/30 rounded-lg relative">
            <div
              className="absolute inset-0 rounded-lg opacity-30 blur-xl pointer-events-none"
              style={{
                background: "radial-gradient(circle at center, var(--coral) 0%, transparent 70%)",
              }}
            />
            <div className="w-10 h-10 rounded-full bg-[var(--coral)] relative z-10" />
            <div className="flex-1 relative z-10">
              <div className="h-4 w-32 bg-[var(--twilight)] rounded" />
              <div className="h-3 w-20 bg-[var(--twilight)] rounded mt-1" />
            </div>
            <div className="flex gap-2 relative z-10">
              <div className="px-3 py-1.5 bg-[var(--coral)] rounded-lg h-8 w-16" />
              <div className="px-3 py-1.5 bg-[var(--twilight)] rounded-lg h-8 w-16" />
            </div>
          </div>

          {/* Fake grouped activity - glass card */}
          <div className="p-4 glass border border-[var(--twilight)] rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-[var(--coral)] border-2 border-[var(--dusk)]" />
                <div className="w-8 h-8 rounded-full bg-[var(--coral)] border-2 border-[var(--dusk)]" />
              </div>
              <div className="h-3 w-24 bg-[var(--coral)]/30 rounded" />
            </div>
            <div className="h-5 w-48 bg-[var(--twilight)] rounded" />
            <div className="h-3 w-32 bg-[var(--twilight)] rounded mt-2" />
          </div>

          {/* Fake activity items - glass cards */}
          {[1, 2].map((i) => (
            <div key={i} className="p-4 glass border border-[var(--twilight)] rounded-lg">
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
