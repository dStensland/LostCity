"use client";

import { Suspense, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import SimpleFilterBar from "@/components/SimpleFilterBar";
import { QuickTagsRow, SubcategoryRow, ActiveFiltersRow } from "@/components/filters";
import PersonalizedIndicator from "./PersonalizedIndicator";
import EventCard, { type FriendGoing } from "@/components/EventCard";
import { useForYouFilters } from "@/lib/hooks/useForYouFilters";
import { useForYouEvents, type FeedEvent } from "@/lib/hooks/useForYouEvents";

interface ForYouViewProps {
  portalSlug: string;
  portalId: string;
}

// Convert API friends_going format to EventCard's FriendGoing format
function convertFriendsGoing(
  friends?: Array<{ user_id: string; username: string; display_name: string | null }>
): FriendGoing[] | undefined {
  if (!friends || friends.length === 0) return undefined;
  return friends.map((f) => ({
    user_id: f.user_id,
    status: "going" as const,
    user: {
      id: f.user_id,
      username: f.username,
      display_name: f.display_name,
      avatar_url: null,
    },
  }));
}

// Loading skeleton for events
function EventSkeleton() {
  return (
    <div className="p-3 rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)]">
      <div className="flex gap-3">
        <div className="w-14 h-10 skeleton-shimmer rounded" />
        <div className="flex-1 space-y-2">
          <div className="h-4 skeleton-shimmer rounded w-3/4" />
          <div className="h-3 skeleton-shimmer rounded w-1/2" />
        </div>
      </div>
    </div>
  );
}

function ForYouViewInner({ portalSlug }: ForYouViewProps) {
  const loaderRef = useRef<HTMLDivElement>(null);
  const { hasActiveFilters } = useForYouFilters();

  const {
    events,
    hasPreferences,
    isLoading,
    isFetchingNextPage,
    hasMore,
    error,
    loadMore,
    refresh,
  } = useForYouEvents({ portalSlug });

  // Intersection observer for infinite scroll
  useEffect(() => {
    const loader = loaderRef.current;
    if (!loader) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingNextPage) {
          loadMore();
        }
      },
      {
        threshold: 0,
        rootMargin: "300px", // Trigger earlier for smooth loading
      }
    );

    observer.observe(loader);
    return () => observer.disconnect();
  }, [hasMore, isFetchingNextPage, loadMore]);

  // Determine context type based on event reasons
  const getContextType = useCallback((event: FeedEvent) => {
    if (!event.reasons?.length) return undefined;
    const firstReason = event.reasons[0];
    switch (firstReason.type) {
      case "followed_venue":
        return "venue" as const;
      case "followed_organization":
        return "producer" as const;
      case "neighborhood":
        return "neighborhood" as const;
      default:
        return "interests" as const;
    }
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <EventSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 bg-[var(--dusk)] border border-[var(--coral)] rounded-lg text-center">
        <p className="text-[var(--coral)] font-mono text-sm">{error}</p>
        <button
          onClick={() => refresh()}
          className="mt-3 px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-xs font-medium rounded-lg hover:bg-[var(--rose)] transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // No preferences and no events - prompt to set preferences
  if (!hasPreferences && events.length === 0) {
    return (
      <div className="space-y-6">
        <div className="p-6 rounded-xl bg-gradient-to-br from-[var(--dusk)] to-[var(--night)] border border-[var(--twilight)] text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--coral)]/20 via-[var(--neon-magenta)]/20 to-[var(--gold)]/20 flex items-center justify-center relative group cursor-default">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-[var(--coral)] icon-neon-pulse"
            >
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
              <path d="M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" opacity={0.6} />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--coral)]/10 to-[var(--gold)]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </div>
          <h3 className="font-serif text-lg text-[var(--cream)] mb-2">
            Tell us what you&apos;re into
          </h3>
          <p className="text-sm text-[var(--muted)] mb-4 max-w-sm mx-auto">
            Set your preferences to get personalized event recommendations based on your interests, favorite neighborhoods, and more.
          </p>
          <Link
            href="/settings/preferences"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
          >
            Set Preferences
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    );
  }

  // Empty state with filters
  if (events.length === 0 && hasActiveFilters) {
    return (
      <div className="p-6 rounded-xl bg-[var(--dusk)] border border-[var(--twilight)] text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--muted)]/10 flex items-center justify-center">
          <svg className="w-6 h-6 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h3 className="font-serif text-lg text-[var(--cream)] mb-2">No events match your filters</h3>
        <p className="text-sm text-[var(--muted)] mb-4">
          Try adjusting your filters or browse all events.
        </p>
      </div>
    );
  }

  // Empty state - all caught up
  if (events.length === 0) {
    return (
      <div className="p-6 rounded-xl bg-[var(--dusk)] border border-[var(--twilight)] text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--cat-community)]/10 flex items-center justify-center">
          <svg className="w-6 h-6 text-[var(--cat-community)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="font-serif text-lg text-[var(--cream)] mb-2">All caught up!</h3>
        <p className="text-sm text-[var(--muted)] mb-4">
          No new events match your preferences right now.
        </p>
        <Link
          href={`/${portalSlug}?view=find`}
          className="inline-flex items-center gap-2 text-[var(--coral)] font-mono text-sm hover:text-[var(--rose)] transition-colors"
        >
          Browse all events
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Event list */}
      <div className="space-y-1">
        {events.map((event, idx) => (
          <EventCard
            key={event.id}
            event={event}
            index={idx}
            portalSlug={portalSlug}
            friendsGoing={convertFriendsGoing(event.friends_going)}
            reasons={event.reasons}
            contextType={getContextType(event)}
            skipAnimation
          />
        ))}
      </div>

      {/* Infinite scroll loader */}
      <div ref={loaderRef} className="py-4">
        {isFetchingNextPage && (
          <div className="flex justify-center">
            <div className="flex items-center gap-2 text-[var(--muted)] font-mono text-xs">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading more...
            </div>
          </div>
        )}
        {!hasMore && events.length > 10 && (
          <div className="text-center text-[var(--muted)] font-mono text-xs py-2">
            You&apos;ve reached the end
          </div>
        )}
      </div>
    </div>
  );
}

export default function ForYouView(props: ForYouViewProps) {
  const { togglePersonalized } = useForYouFilters();
  const { personalization } = useForYouEvents({ portalSlug: props.portalSlug });

  return (
    <div className="py-4">
      {/* Filter bar */}
      <Suspense fallback={<div className="h-10 bg-[var(--night)]" />}>
        <SimpleFilterBar variant="full" />
        {/* Layered filter rows */}
        <div className="sticky top-[156px] z-10 bg-[var(--night)] border-b border-[var(--twilight)]">
          <div className="max-w-5xl mx-auto">
            {/* Quick Tags - always visible */}
            <QuickTagsRow />
            {/* Subcategories - appears when category selected */}
            <SubcategoryRow />
            {/* Active Filters - appears when filters active */}
            <div className="px-4 pb-2">
              <ActiveFiltersRow />
            </div>
          </div>
        </div>
        {/* Personalized indicator */}
        <PersonalizedIndicator
          personalization={personalization}
          onToggle={togglePersonalized}
        />
      </Suspense>

      {/* Main content */}
      <Suspense
        fallback={
          <div className="space-y-3 pt-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <EventSkeleton key={i} />
            ))}
          </div>
        }
      >
        <ForYouViewInner {...props} />
      </Suspense>
    </div>
  );
}
