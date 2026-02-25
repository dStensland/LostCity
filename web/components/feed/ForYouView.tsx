"use client";

import {
  Suspense,
  useRef,
  useEffect,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import FeedSectionHeader from "./FeedSectionHeader";
import ForYouOnboarding from "./ForYouOnboarding";
import EventCard, { HeroEventCard } from "@/components/EventCard";
import { convertFriendsGoing } from "@/lib/formats";
import { useAuth } from "@/lib/auth-context";
import {
  useForYouEvents,
  type FeedEvent,
  type FeedSection,
} from "@/lib/hooks/useForYouEvents";
import {
  Sparkle,
  CalendarDots,
  UsersThree,
  Compass,
  ArrowsClockwise,
  CheckCircle,
  MagnifyingGlass,
} from "@phosphor-icons/react/dist/ssr";

// Section visual identity - paired with API-driven titles
const SECTION_CONFIG: Record<
  FeedSection["id"],
  {
    priority: "primary" | "secondary" | "tertiary";
    accentColor: string;
    icon: ReactNode;
    badge?: string;
    useHeroFirst?: boolean;
    useCompact?: boolean;
  }
> = {
  tonight_for_you: {
    priority: "primary",
    accentColor: "var(--coral)",
    icon: <Sparkle size={24} weight="fill" />,
    badge: "Tonight",
    useHeroFirst: true,
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
    useCompact: true,
  },
};

interface ForYouViewProps {
  portalSlug: string;
  portalId: string;
}

// Loading skeleton for events
function EventSkeleton({ hero }: { hero?: boolean }) {
  if (hero) {
    return (
      <div className="rounded-2xl overflow-hidden border border-[var(--twilight)] bg-[var(--card-bg)]">
        <div className="h-48 sm:h-56 skeleton-shimmer" />
        <div className="p-4 space-y-2">
          <div className="h-5 skeleton-shimmer rounded w-2/3" />
          <div className="h-3 skeleton-shimmer rounded w-1/2" />
        </div>
      </div>
    );
  }
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

  const config =
    SECTION_CONFIG[section.id] ?? SECTION_CONFIG.explore_something_new;
  const [heroEvent, ...restEvents] = section.events;

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

      {/* Hero treatment for primary sections */}
      {config.useHeroFirst && heroEvent && (
        <div className="mb-1">
          <HeroEventCard
            event={heroEvent}
            portalSlug={portalSlug}
          />
        </div>
      )}

      {/* Remaining events */}
      <div className="space-y-3">
        {(config.useHeroFirst ? restEvents : section.events).map(
          (event, index) => (
            <EventCard
              key={event.id}
              event={event}
              index={index}
              portalSlug={portalSlug}
              friendsGoing={convertFriendsGoing(event.friends_going)}
              reasons={event.reasons}
              contextType={getContextType(event)}
              density={config.useCompact ? "compact" : "comfortable"}
              skipAnimation
            />
          ),
        )}
      </div>
    </section>
  );
}

// Reveal transition after onboarding completes
function OnboardingReveal({
  eventCount,
  onContinue,
}: {
  eventCount: number;
  onContinue: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onContinue, 2400);
    return () => clearTimeout(timer);
  }, [onContinue]);

  return (
    <div className="flex flex-col items-center justify-center py-16 animate-in fade-in duration-500">
      <div className="w-16 h-16 mb-5 rounded-2xl bg-gradient-to-br from-[var(--coral)]/20 to-[var(--gold)]/20 flex items-center justify-center">
        <Sparkle size={32} weight="fill" className="text-[var(--coral)]" />
      </div>
      <h3 className="text-xl font-semibold text-[var(--cream)] mb-2">
        You&apos;re all set
      </h3>
      <p className="text-sm text-[var(--muted)] text-center max-w-xs">
        {eventCount > 0 ? (
          <>
            We found{" "}
            <span className="text-[var(--cream)] font-medium">
              {eventCount} events
            </span>{" "}
            that match your vibe this week.
          </>
        ) : (
          "Your personalized feed is ready."
        )}
      </p>
      <div className="mt-6 flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[var(--coral)] animate-pulse"
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function ForYouViewInner({ portalSlug }: ForYouViewProps) {
  const loaderRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const { user, loading: authLoading } = useAuth();
  const [showReveal, setShowReveal] = useState(false);
  const hasRefreshedAfterAuth = useRef(false);

  const {
    events,
    sections,
    hasPreferences,
    isLoading,
    isRefetching,
    isFetchingNextPage,
    hasMore,
    error,
    loadMore,
    refresh,
  } = useForYouEvents({ portalSlug });

  // When auth resolves with a user, refetch feed to clear stale 401 data
  useEffect(() => {
    if (!authLoading && user && !hasRefreshedAfterAuth.current && events.length === 0 && !isLoading) {
      hasRefreshedAfterAuth.current = true;
      refresh();
    }
  }, [authLoading, user, events.length, isLoading, refresh]);

  // Virtualize the event list for performance (flat list fallback)
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    overscan: 5,
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
      { threshold: 0, rootMargin: "300px" },
    );

    observer.observe(loader);
    return () => observer.disconnect();
  }, [hasMore, isFetchingNextPage, loadMore]);

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

  // Handle onboarding completion with reveal
  const handleOnboardingComplete = useCallback(() => {
    setShowReveal(true);
  }, []);

  const handleRevealDone = useCallback(() => {
    setShowReveal(false);
    refresh();
  }, [refresh]);

  // Loading state - includes auth loading and post-auth refetch
  if (authLoading || isLoading || isRefetching) {
    return (
      <div className="space-y-4 pt-2">
        <EventSkeleton hero />
        {[1, 2, 3].map((i) => (
          <EventSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 bg-[var(--dusk)] border border-[var(--coral)]/40 rounded-xl text-center">
        <p className="text-[var(--coral)] font-mono text-sm mb-1">
          Something went wrong
        </p>
        <p className="text-xs text-[var(--muted)] mb-4">{error}</p>
        <button
          onClick={() => refresh()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-xs font-medium rounded-lg hover:bg-[var(--rose)] transition-colors"
        >
          <ArrowsClockwise size={14} weight="bold" />
          Try again
        </button>
      </div>
    );
  }

  // Not signed in - show preview with blurred teaser
  if (!user && events.length === 0) {
    return (
      <div className="space-y-5">
        <div className="p-6 rounded-xl bg-gradient-to-br from-[var(--dusk)] to-[var(--night)] border border-[var(--twilight)] text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--coral)]/20 to-[var(--gold)]/20 flex items-center justify-center">
            <Sparkle size={28} weight="fill" className="text-[var(--coral)]" />
          </div>
          <h3 className="font-serif text-lg text-[var(--cream)] mb-1.5">
            Your city, your way
          </h3>
          <p className="text-sm text-[var(--muted)] mb-5 max-w-sm mx-auto">
            Sign in and we&apos;ll learn what you love &mdash; the neighborhoods
            you explore, the venues you follow, the scenes your friends are into.
          </p>
          <Link
            href={`/auth/signup?redirect=/${portalSlug}?view=feed&tab=foryou`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
          >
            Get started
          </Link>
        </div>
        {/* Blurred teaser cards to show what personalized feed looks like */}
        <div className="relative">
          <div className="space-y-3 blur-[6px] opacity-50 pointer-events-none select-none" aria-hidden="true">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-3 rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)]"
              >
                <div className="flex gap-3">
                  <div className="w-14 h-10 rounded bg-[var(--twilight)]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 rounded bg-[var(--twilight)] w-3/4" />
                    <div className="h-3 rounded bg-[var(--twilight)] w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Onboarding reveal transition
  if (showReveal) {
    return (
      <OnboardingReveal
        eventCount={events.length}
        onContinue={handleRevealDone}
      />
    );
  }

  // No preferences - onboarding
  if (!hasPreferences && events.length === 0) {
    return <ForYouOnboarding onComplete={handleOnboardingComplete} />;
  }

  // All caught up - but make it a gateway, not a dead end
  if (events.length === 0) {
    return (
      <div className="space-y-5">
        <div className="p-6 rounded-xl bg-[var(--dusk)] border border-[var(--twilight)] text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--cat-community)]/10 flex items-center justify-center">
            <CheckCircle
              size={24}
              weight="light"
              className="text-[var(--cat-community)]"
            />
          </div>
          <h3 className="font-serif text-lg text-[var(--cream)] mb-1.5">
            You&apos;re all caught up
          </h3>
          <p className="text-sm text-[var(--muted)] mb-5">
            Nothing new matches your vibe right now. Here&apos;s what you can do:
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
            <Link
              href={`/${portalSlug}?view=find&type=events`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-xs font-medium hover:bg-[var(--rose)] transition-colors"
            >
              <MagnifyingGlass size={14} weight="bold" />
              Browse all events
            </Link>
            <Link
              href={`/${portalSlug}?view=feed&tab=explore`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-[var(--twilight)] text-[var(--cream)] rounded-lg font-mono text-xs font-medium hover:border-[var(--soft)]/40 transition-colors"
            >
              <Compass size={14} weight="light" />
              Explore editorial tracks
            </Link>
          </div>
        </div>
        <button
          onClick={() => refresh()}
          className="w-full flex items-center justify-center gap-2 py-2 text-[var(--muted)] font-mono text-xs hover:text-[var(--cream)] transition-colors"
        >
          <ArrowsClockwise size={12} />
          Refresh feed
        </button>
      </div>
    );
  }

  // Main content: section-based display
  const visibleSections = sections.filter((s) => s.events.length > 0);

  if (visibleSections.length > 0) {
    return (
      <div className="space-y-2">
        {visibleSections.map((section, idx) => (
          <div key={section.id}>
            {idx > 0 && (
              <div className="h-px bg-gradient-to-r from-transparent via-[var(--twilight)] to-transparent my-5" />
            )}
            <ForYouSectionBlock
              section={section}
              portalSlug={portalSlug}
              getContextType={getContextType}
            />
          </div>
        ))}

        {/* Infinite scroll continuation after sections */}
        {events.length > 0 && (
          <>
            <div className="h-px bg-gradient-to-r from-transparent via-[var(--twilight)] to-transparent my-5" />
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-[var(--muted)] mb-3">
              More for you
            </p>
            {(() => {
              // Show events not already in sections
              const sectionEventIds = new Set(
                visibleSections.flatMap((s) => s.events.map((e) => e.id)),
              );
              const remainingEvents = events.filter(
                (e) => !sectionEventIds.has(e.id),
              );
              if (remainingEvents.length === 0) return null;
              return (
                <div className="space-y-3">
                  {remainingEvents.map((event, index) => (
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
              );
            })()}

            <div ref={loaderRef} className="py-4">
              {isFetchingNextPage && (
                <div className="flex justify-center">
                  <div className="flex items-center gap-2 text-[var(--muted)] font-mono text-xs">
                    <ArrowsClockwise
                      size={14}
                      className="animate-spin"
                    />
                    Loading more...
                  </div>
                </div>
              )}
              {!hasMore && events.length > 10 && (
                <div className="text-center text-[var(--muted)] font-mono text-xs py-2">
                  You&apos;ve seen it all
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // Flat list fallback (when no sections, e.g. filtered or few events)
  const virtualItems = virtualizer.getVirtualItems();
  const shouldVirtualize = events.length > 40 && virtualItems.length > 0;

  if (shouldVirtualize) {
    return (
      <div ref={parentRef} className="space-y-0">
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
        <div ref={loaderRef} className="py-4">
          {isFetchingNextPage && (
            <div className="flex justify-center">
              <div className="flex items-center gap-2 text-[var(--muted)] font-mono text-xs">
                <ArrowsClockwise size={14} className="animate-spin" />
                Loading more...
              </div>
            </div>
          )}
          {!hasMore && events.length > 10 && (
            <div className="text-center text-[var(--muted)] font-mono text-xs py-2">
              You&apos;ve seen it all
            </div>
          )}
        </div>
      </div>
    );
  }

  // Standard flat list (< 40 events)
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
              <ArrowsClockwise size={14} className="animate-spin" />
              Loading more...
            </div>
          </div>
        )}
        {!hasMore && events.length > 10 && (
          <div className="text-center text-[var(--muted)] font-mono text-xs py-2">
            You&apos;ve seen it all
          </div>
        )}
      </div>
    </div>
  );
}

export default function ForYouView(props: ForYouViewProps) {
  return (
    <div className="pt-2">
      <Suspense
        fallback={
          <div className="space-y-4 pt-2">
            <EventSkeleton hero />
            {[1, 2, 3].map((i) => (
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
