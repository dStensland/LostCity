"use client";

import { Suspense, useRef, useEffect, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import SimpleFilterBar from "@/components/SimpleFilterBar";
import {
  QuickTagsRow,
  SubcategoryRow,
  ActiveFiltersRow,
} from "@/components/filters";
import PersonalizedIndicator from "./PersonalizedIndicator";
import FeedSectionHeader from "./FeedSectionHeader";
import ForYouOnboarding from "./ForYouOnboarding";
import EventCard from "@/components/EventCard";
import { useForYouFilters } from "@/lib/hooks/useForYouFilters";
import {
  useForYouEvents,
  type FeedEvent,
  type FeedSection,
} from "@/lib/hooks/useForYouEvents";
import { convertFriendsGoing } from "@/lib/formats";
import { useAuth } from "@/lib/auth-context";
import {
  Sparkle,
  CalendarDots,
  UsersThree,
  Compass,
} from "@phosphor-icons/react/dist/ssr";

// Per-section visual identity config
const SECTION_CONFIG: Record<
  FeedSection["id"],
  {
    priority: "primary" | "secondary" | "tertiary";
    accentColor: string;
    icon: ReactNode;
    badge?: string;
  }
> = {
  tonight_for_you: {
    priority: "primary",
    accentColor: "var(--coral)",
    icon: <Sparkle size={24} weight="fill" />,
    badge: "Tonight",
  },
  this_week_fits_your_taste: {
    priority: "secondary",
    accentColor: "var(--gold)",
    icon: <CalendarDots size={20} weight="light" />,
  },
  from_places_people_you_follow: {
    priority: "secondary",
    accentColor: "var(--lavender)",
    icon: <UsersThree size={20} weight="light" />,
  },
  explore_something_new: {
    priority: "tertiary",
    accentColor: "var(--neon-cyan)",
    icon: <Compass size={16} weight="light" />,
  },
};

interface ForYouViewProps {
  portalSlug: string;
  portalId: string;
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

function ForYouSectionBlock({
  section,
  portalSlug,
  getContextType,
}: {
  section: FeedSection;
  portalSlug: string;
  getContextType: (
    event: FeedEvent,
  ) => "venue" | "producer" | "neighborhood" | "interests" | undefined;
}) {
  if (section.events.length === 0) return null;

  const config = SECTION_CONFIG[section.id] ?? SECTION_CONFIG.explore_something_new;

  return (
    <section className="space-y-3">
      <FeedSectionHeader
        title={section.title}
        subtitle={section.description}
        priority={config.priority}
        accentColor={config.accentColor}
        icon={config.icon}
        badge={config.badge}
      />
      <div className="space-y-3">
        {section.events.map((event, index) => (
          <EventCard
            key={event.id}
            event={event}
            index={index}
            portalSlug={portalSlug}
            friendsGoing={convertFriendsGoing(event.friends_going)}
            reasons={event.reasons}
            contextType={getContextType(event)}
            skipAnimation
          />
        ))}
      </div>
    </section>
  );
}

function ForYouViewInner({ portalSlug }: ForYouViewProps) {
  const loaderRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const { hasActiveFilters } = useForYouFilters();
  const { user } = useAuth();

  const {
    events,
    sections,
    hasPreferences,
    isLoading,
    isFetchingNextPage,
    hasMore,
    error,
    loadMore,
    refresh,
  } = useForYouEvents({ portalSlug });

  // Virtualize the event list for performance
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // Average event card height
    overscan: 5, // Render 5 items above/below viewport
  });

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
      },
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

  // No preferences and no events - inline onboarding
  if (!user && events.length === 0) {
    return (
      <div className="p-6 rounded-xl bg-[var(--dusk)] border border-[var(--twilight)] text-center">
        <h3 className="font-serif text-lg text-[var(--cream)] mb-2">
          Sign in for your personalized feed
        </h3>
        <p className="text-sm text-[var(--muted)] mb-4">
          We&apos;ll tailor picks based on your follows, neighborhoods, and interests.
        </p>
        <Link
          href={`/${portalSlug}?view=find&type=events`}
          className="inline-flex items-center gap-2 text-[var(--coral)] font-mono text-sm hover:text-[var(--rose)] transition-colors"
        >
          Browse all events
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </Link>
      </div>
    );
  }

  if (!hasPreferences && events.length === 0) {
    return <ForYouOnboarding onComplete={() => refresh()} />;
  }

  // Empty state with filters
  if (events.length === 0 && hasActiveFilters) {
    return (
      <div className="p-6 rounded-xl bg-[var(--dusk)] border border-[var(--twilight)] text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--muted)]/10 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-[var(--muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <h3 className="font-serif text-lg text-[var(--cream)] mb-2">
          No events match your filters
        </h3>
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
          <svg
            className="w-6 h-6 text-[var(--cat-community)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="font-serif text-lg text-[var(--cream)] mb-2">
          All caught up!
        </h3>
        <p className="text-sm text-[var(--muted)] mb-4">
          No new events match your preferences right now.
        </p>
        <Link
          href={`/${portalSlug}?view=find`}
          className="inline-flex items-center gap-2 text-[var(--coral)] font-mono text-sm hover:text-[var(--rose)] transition-colors"
        >
          Browse all events
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </Link>
      </div>
    );
  }

  const showSectionedFeed = !hasActiveFilters && sections.length > 0;
  if (showSectionedFeed) {
    const visibleSections = sections.filter((s) => s.events.length > 0);
    return (
      <div className="space-y-2">
        {visibleSections.map((section, idx) => (
          <div key={section.id}>
            {idx > 0 && (
              <div className="h-px bg-gradient-to-r from-transparent via-[var(--twilight)] to-transparent my-4" />
            )}
            <ForYouSectionBlock
              section={section}
              portalSlug={portalSlug}
              getContextType={getContextType}
            />
          </div>
        ))}
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();
  const shouldUseVirtualizedList = events.length > 40 && virtualItems.length > 0;

  if (!shouldUseVirtualizedList) {
    return (
      <div className="space-y-3">
        {events.map((event, index) => (
          <EventCard
            key={event.id}
            event={event}
            index={index}
            portalSlug={portalSlug}
            friendsGoing={convertFriendsGoing(event.friends_going)}
            reasons={event.reasons}
            contextType={getContextType(event)}
            skipAnimation
          />
        ))}

        <div ref={loaderRef} className="py-4">
          {isFetchingNextPage && (
            <div className="flex justify-center">
              <div className="flex items-center gap-2 text-[var(--muted)] font-mono text-xs">
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
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

  return (
    <div ref={parentRef} className="space-y-0">
      {/* Virtualized event list */}
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualItem) => {
          const event = events[virtualItem.index];
          return (
            <div
              key={event.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
            >
              <EventCard
                event={event}
                index={virtualItem.index}
                portalSlug={portalSlug}
                friendsGoing={convertFriendsGoing(event.friends_going)}
                reasons={event.reasons}
                contextType={getContextType(event)}
                skipAnimation
              />
            </div>
          );
        })}
      </div>

      {/* Infinite scroll loader */}
      <div ref={loaderRef} className="py-4">
        {isFetchingNextPage && (
          <div className="flex justify-center">
            <div className="flex items-center gap-2 text-[var(--muted)] font-mono text-xs">
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
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
        <div className="sticky top-14 z-10 bg-[var(--night)] border-b border-[var(--twilight)]">
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
