"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import EventCard, { type FriendGoing } from "@/components/EventCard";
import type { RecommendationReason } from "@/components/ReasonBadge";
import { getLocalDateString } from "@/lib/formats";

// Event type matching API response - compatible with EventCard
type FeedEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  category: string | null;
  image_url: string | null;
  ticket_url: string | null;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
    slug?: string | null;
  } | null;
  score?: number;
  reasons?: RecommendationReason[];
  friends_going?: Array<{
    user_id: string;
    username: string;
    display_name: string | null;
  }>;
};

type UserPreferences = {
  favorite_categories: string[];
  favorite_neighborhoods: string[];
  favorite_vibes: string[];
  price_preference: string | null;
};

type TrendingEvent = FeedEvent & {
  rsvp_count?: number;
};

// Lost City style SVG icons for each section
const SectionIcons = {
  // Friends going - Two connected people
  friendsGoing: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="6" r="3" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <circle cx="16" cy="6" r="3" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M2 20c0-4 3-6 6-6M22 20c0-4-3-6-6-6" strokeWidth={1.5} strokeLinecap="round" fill="none" stroke="currentColor" />
      <path d="M8 14h8" strokeWidth={1.5} stroke="currentColor" opacity={0.6} />
    </svg>
  ),
  // Your interests - Sparkle / star burst
  yourInterests: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
      <path d="M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" opacity={0.6} />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  ),
  // Followed venues - Pin / marker
  followedVenues: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8 2 5 5.5 5 9c0 5 7 13 7 13s7-8 7-13c0-3.5-3-7-7-7z" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <circle cx="12" cy="9" r="2.5" fill="currentColor" />
    </svg>
  ),
  // Followed organizations - Theater curtains
  followedOrganizations: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 3h20v2c0 1-1 2-2 2H4c-1 0-2-1-2-2V3z" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M4 7c1 2 1 6 0 14" strokeWidth={1.5} strokeLinecap="round" fill="none" stroke="currentColor" />
      <path d="M7 7c.5 3 0 8-2 14" strokeWidth={1.5} strokeLinecap="round" fill="none" stroke="currentColor" opacity={0.5} />
      <path d="M20 7c-1 2-1 6 0 14" strokeWidth={1.5} strokeLinecap="round" fill="none" stroke="currentColor" />
      <path d="M17 7c-.5 3 0 8 2 14" strokeWidth={1.5} strokeLinecap="round" fill="none" stroke="currentColor" opacity={0.5} />
      <circle cx="12" cy="14" r="2" fill="currentColor" opacity={0.4} />
    </svg>
  ),
  // Neighborhoods - Compass
  yourNeighborhoods: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <polygon points="12,3 14,12 12,10 10,12" fill="currentColor" />
      <polygon points="12,21 10,12 12,14 14,12" fill="currentColor" opacity={0.4} />
    </svg>
  ),
  // Trending - Flame
  trending: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2c-2 4-5 6-5 10a5 5 0 0010 0c0-4-3-6-5-10z" strokeWidth={1.5} fill="none" stroke="currentColor" />
      <path d="M12 8c-1 2-2 3-2 5a2 2 0 004 0c0-2-1-3-2-5z" fill="currentColor" opacity={0.5} />
    </svg>
  ),
};

// Section configuration with icons and colors
const SECTION_CONFIG = {
  friendsGoing: {
    title: "Friends Are Going",
    icon: SectionIcons.friendsGoing,
    color: "#00FFFF", // cyan
  },
  yourInterests: {
    title: "Based on Your Interests",
    icon: SectionIcons.yourInterests,
    color: "#00FFFF", // cyan
  },
  followedVenues: {
    title: "From Venues You Follow",
    icon: SectionIcons.followedVenues,
    color: "#FF00FF", // magenta
  },
  followedOrganizations: {
    title: "From Organizations You Follow",
    icon: SectionIcons.followedOrganizations,
    color: "#FFD700", // gold
  },
  yourNeighborhoods: {
    title: "In Your Neighborhoods",
    icon: SectionIcons.yourNeighborhoods,
    color: "#FFA500", // orange
  },
  trending: {
    title: "Trending This Week",
    icon: SectionIcons.trending,
    color: "#FF6B6B", // coral
  },
} as const;

// Quick filter options
type QuickFilter = "all" | "today" | "weekend" | "free";

// QuickFilters component
function QuickFilters({
  selected,
  onChange
}: {
  selected: QuickFilter;
  onChange: (filter: QuickFilter) => void;
}) {
  const filters: { key: QuickFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "today", label: "Today" },
    { key: "weekend", label: "Weekend" },
    { key: "free", label: "Free" },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-4">
      {filters.map((filter) => (
        <button
          key={filter.key}
          onClick={() => onChange(filter.key)}
          className={`px-3 py-1.5 rounded-full font-mono text-xs whitespace-nowrap transition-all ${
            selected === filter.key
              ? "bg-[var(--coral)] text-[var(--void)] font-medium"
              : "bg-[var(--twilight)] text-[var(--soft)] border border-[var(--twilight)] hover:text-[var(--cream)] hover:border-[var(--muted)]"
          }`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

// FriendsGoingHighlight component - shows events where friends are going
function FriendsGoingHighlight({
  events,
  portalSlug,
}: {
  events: FeedEvent[];
  portalSlug: string;
}) {
  if (events.length === 0) return null;

  return (
    <section className="mb-8">
      {/* Section header with cyan accent - improved spacing */}
      <div className="flex items-center gap-2 mb-4 px-1">
        <div
          className="w-1 h-5 rounded-full"
          style={{ backgroundColor: SECTION_CONFIG.friendsGoing.color }}
        />
        <span className="icon-neon-subtle" style={{ color: SECTION_CONFIG.friendsGoing.color }}>{SECTION_CONFIG.friendsGoing.icon}</span>
        <h2
          className="font-semibold text-sm"
          style={{ color: SECTION_CONFIG.friendsGoing.color }}
        >
          {SECTION_CONFIG.friendsGoing.title}
        </h2>
        <span
          className="ml-auto px-2 py-0.5 rounded-full text-[0.65rem] font-mono font-medium"
          style={{
            backgroundColor: `${SECTION_CONFIG.friendsGoing.color}20`,
            color: SECTION_CONFIG.friendsGoing.color,
          }}
        >
          {events.length}
        </span>
      </div>

      {/* Highlighted cards with subtle cyan background - simplified border treatment */}
      <div className="space-y-3 p-3 rounded-xl border border-[var(--neon-cyan)]/25 bg-[var(--neon-cyan)]/5">
        {events.slice(0, 3).map((event, idx) => (
          <EventCard
            key={event.id}
            event={event as never}
            index={idx}
            portalSlug={portalSlug}
            friendsGoing={convertFriendsGoing(event.friends_going)}
            reasons={event.reasons}
            showThumbnail={idx < 2 && !!event.image_url}
            skipAnimation
          />
        ))}
      </div>
    </section>
  );
}

// ExpandableSection component - replaces CollapsibleSection
function ExpandableSection({
  title,
  icon,
  accentColor,
  contextType,
  events,
  portalSlug,
  initialVisible = 3,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  accentColor: string;
  contextType?: "interests" | "venue" | "producer" | "neighborhood";
  events: FeedEvent[];
  portalSlug: string;
  initialVisible?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleEvents = showAll ? events : events.slice(0, initialVisible);
  const hiddenCount = events.length - initialVisible;
  const hasMore = hiddenCount > 0;

  if (events.length === 0) return null;

  return (
    <section className="mb-8">
      {/* Section header - always visible, improved spacing */}
      <div className="flex items-center gap-2 mb-4 px-1">
        <div
          className="w-1 h-5 rounded-full"
          style={{ backgroundColor: accentColor }}
        />
        <span className="icon-neon-subtle" style={{ color: accentColor }}>{icon}</span>
        <h2
          className="font-semibold text-sm"
          style={{ color: accentColor }}
        >
          {title}
        </h2>
        {/* Show "X of Y" only when there's more to show, otherwise just total */}
        <span
          className="ml-auto px-2 py-0.5 rounded-full text-[0.65rem] font-mono font-medium"
          style={{
            backgroundColor: `${accentColor}20`,
            color: accentColor,
          }}
        >
          {hasMore && !showAll ? `${initialVisible} of ${events.length}` : events.length}
        </span>
      </div>

      {/* Events - always visible */}
      <div>
        {visibleEvents.map((event, idx) => (
          <EventCard
            key={event.id}
            event={event as never}
            index={idx}
            portalSlug={portalSlug}
            reasons={event.reasons}
            friendsGoing={convertFriendsGoing(event.friends_going)}
            contextType={contextType}
            showThumbnail={idx < 2 && !!event.image_url}
            skipAnimation
          />
        ))}
      </div>

      {/* Show more button */}
      {!showAll && hasMore && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full mt-2 py-2 text-center text-xs font-mono font-medium tracking-wider rounded-lg border transition-all hover:opacity-80"
          style={{
            color: accentColor,
            borderColor: `${accentColor}30`,
            background: `${accentColor}08`,
          }}
        >
          Show {hiddenCount} more
        </button>
      )}
    </section>
  );
}

interface ForYouFeedProps {
  portalSlug: string;
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

export default function ForYouFeed({ portalSlug }: ForYouFeedProps) {
  console.log("[ForYouFeed] Component mounting, portalSlug:", portalSlug);

  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [trendingEvents, setTrendingEvents] = useState<TrendingEvent[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPreferences, setHasPreferences] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const mountedRef = useRef(true);

  const loadFeed = useCallback(async () => {
    console.log("[ForYouFeed] loadFeed called");
    try {
      setError(null);
      setLoading(true);

      const [feedRes, trendingRes, prefsRes] = await Promise.all([
        fetch(`/api/feed?limit=100&portal=${portalSlug}`),
        fetch(`/api/trending?limit=10&portal=${portalSlug}`),
        fetch(`/api/preferences`),
      ]);

      if (!mountedRef.current) return;

      if (!feedRes.ok) {
        const errorData = await feedRes.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to load feed (${feedRes.status})`);
      }

      const feedData = await feedRes.json();
      const trendingData = trendingRes.ok ? await trendingRes.json() : { events: [] };
      const prefsData = prefsRes.ok ? await prefsRes.json() : null;

      if (mountedRef.current) {
        // Debug logging - visible in browser console
        console.log("[ForYouFeed] API response:", {
          totalEvents: feedData.events?.length || 0,
          hasPreferences: feedData.hasPreferences,
          eventsWithVenueReason: feedData.events?.filter((e: FeedEvent) =>
            e.reasons?.some((r) => r.type === "followed_venue")
          ).length || 0,
          eventsWithOrganizationReason: feedData.events?.filter((e: FeedEvent) =>
            e.reasons?.some((r) => r.type === "followed_organization")
          ).length || 0,
          preferences: prefsData,
          // Show debug info from API
          _debug: feedData._debug,
        });

        // Log first few events with their reasons for debugging
        if (feedData.events?.length > 0) {
          console.log("[ForYouFeed] Sample events with reasons:",
            feedData.events.slice(0, 5).map((e: FeedEvent) => ({
              id: e.id,
              title: e.title.substring(0, 30),
              reasons: e.reasons,
              venueId: e.venue?.id,
            }))
          );
        }

        setEvents(feedData.events || []);
        setHasPreferences(feedData.hasPreferences);
        setTrendingEvents(trendingData.events || []);
        setPreferences(prefsData);
        setLoading(false);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      console.error("Failed to load feed:", err);
      setError("Failed to load feed");
      setLoading(false);
    }
  }, [portalSlug]);

  useEffect(() => {
    mountedRef.current = true;
    loadFeed();

    return () => {
      mountedRef.current = false;
    };
  }, [loadFeed]);

  // Apply quick filter to events
  const filteredEvents = useMemo(() => {
    if (quickFilter === "all") return events;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = getLocalDateString(today);

    // Get weekend dates (Saturday and Sunday)
    const dayOfWeek = today.getDay();
    const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
    const saturday = new Date(today);
    saturday.setDate(saturday.getDate() + (dayOfWeek === 6 ? 0 : daysUntilSaturday));
    const sunday = new Date(saturday);
    sunday.setDate(sunday.getDate() + 1);
    const saturdayStr = getLocalDateString(saturday);
    const sundayStr = getLocalDateString(sunday);

    return events.filter((e) => {
      if (quickFilter === "today") {
        return e.start_date === todayStr;
      }
      if (quickFilter === "weekend") {
        return e.start_date === saturdayStr || e.start_date === sundayStr;
      }
      if (quickFilter === "free") {
        return e.is_free;
      }
      return true;
    });
  }, [events, quickFilter]);

  // Group events by section
  const grouped = useMemo(() => {
    const seenEventIds = new Set<number>();

    // Events where friends are going (highest priority)
    const friendsGoing = filteredEvents.filter((e) =>
      e.friends_going && e.friends_going.length > 0
    );

    // Events matching user's favorite categories (that don't have a more specific reason)
    const yourInterests = filteredEvents.filter((e) => {
      if (!preferences?.favorite_categories?.length) return false;
      if (!e.category) return false;
      // Only include if category matches AND doesn't have a follow-based reason
      const hasFollowReason = e.reasons?.some(
        (r) => r.type === "followed_venue" || r.type === "followed_organization"
      );
      return preferences.favorite_categories.includes(e.category) && !hasFollowReason;
    });

    // Events from followed venues
    const followedVenues = filteredEvents.filter((e) =>
      e.reasons?.some((r) => r.type === "followed_venue")
    );

    // Events from followed organizations
    const followedOrganizations = filteredEvents.filter((e) =>
      e.reasons?.some((r) => r.type === "followed_organization")
    );

    // Events in user's favorite neighborhoods (that aren't already shown via follows)
    const yourNeighborhoods = filteredEvents.filter((e) => {
      if (!preferences?.favorite_neighborhoods?.length) return false;
      if (!e.venue?.neighborhood) return false;
      // Only exclude if already shown via followed venue/organization
      const hasFollowReason = e.reasons?.some(
        (r) => r.type === "followed_venue" || r.type === "followed_organization"
      );
      return (
        preferences.favorite_neighborhoods.includes(e.venue.neighborhood) &&
        !hasFollowReason
      );
    });

    // Helper to dedupe events within each section
    const dedupeSection = (sectionEvents: FeedEvent[]): FeedEvent[] => {
      return sectionEvents.filter((e) => {
        if (seenEventIds.has(e.id)) return false;
        seenEventIds.add(e.id);
        return true;
      });
    };

    return {
      friendsGoing: dedupeSection(friendsGoing).slice(0, 15),
      yourInterests: dedupeSection(yourInterests).slice(0, 15),
      followedVenues: dedupeSection(followedVenues).slice(0, 15),
      followedOrganizations: dedupeSection(followedOrganizations).slice(0, 15),
      yourNeighborhoods: dedupeSection(yourNeighborhoods).slice(0, 15),
    };
  }, [filteredEvents, preferences]);

  // Check if any sections have content
  const hasSections =
    grouped.friendsGoing.length > 0 ||
    grouped.yourInterests.length > 0 ||
    grouped.followedVenues.length > 0 ||
    grouped.followedOrganizations.length > 0 ||
    grouped.yourNeighborhoods.length > 0;

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-3 rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)]">
            <div className="flex gap-3">
              <div className="w-14 h-10 skeleton-shimmer rounded" />
              <div className="flex-1 space-y-2">
                <div className="h-4 skeleton-shimmer rounded w-3/4" />
                <div className="h-3 skeleton-shimmer rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-[var(--dusk)] border border-[var(--coral)] rounded-lg text-center">
        <p className="text-[var(--coral)] font-mono text-sm">{error}</p>
        <button
          onClick={() => loadFeed()}
          className="mt-3 px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-xs font-medium rounded-lg hover:bg-[var(--rose)] transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // No preferences set - prompt to set them
  if (!hasPreferences && !hasSections) {
    return (
      <div className="space-y-6">
        <div className="p-6 rounded-xl bg-gradient-to-br from-[var(--dusk)] to-[var(--night)] border border-[var(--twilight)] text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--neon-cyan)]/20 via-[var(--neon-magenta)]/20 to-[var(--coral)]/20 flex items-center justify-center relative group cursor-default">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[var(--neon-cyan)] icon-neon-pulse">
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" />
              <path d="M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" strokeWidth={1.5} strokeLinecap="round" stroke="currentColor" opacity={0.6} />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--neon-cyan)]/10 to-[var(--coral)]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
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

        {/* Show trending as fallback - always expanded */}
        {trendingEvents.length > 0 && (
          <ExpandableSection
            title={SECTION_CONFIG.trending.title}
            icon={SECTION_CONFIG.trending.icon}
            count={trendingEvents.length}
            accentColor={SECTION_CONFIG.trending.color}
            events={trendingEvents}
            portalSlug={portalSlug}
          />
        )}
      </div>
    );
  }

  // Main content with sections
  return (
    <div className="space-y-4">
      {/* Quick filters */}
      <QuickFilters selected={quickFilter} onChange={setQuickFilter} />

      {/* Friends Going Highlight - top priority social proof */}
      <FriendsGoingHighlight
        events={grouped.friendsGoing}
        portalSlug={portalSlug}
      />

      {/* Based on Your Interests */}
      <ExpandableSection
        title={SECTION_CONFIG.yourInterests.title}
        icon={SECTION_CONFIG.yourInterests.icon}
        count={grouped.yourInterests.length}
        accentColor={SECTION_CONFIG.yourInterests.color}
        contextType="interests"
        events={grouped.yourInterests}
        portalSlug={portalSlug}
      />

      {/* From Venues You Follow */}
      <ExpandableSection
        title={SECTION_CONFIG.followedVenues.title}
        icon={SECTION_CONFIG.followedVenues.icon}
        count={grouped.followedVenues.length}
        accentColor={SECTION_CONFIG.followedVenues.color}
        contextType="venue"
        events={grouped.followedVenues}
        portalSlug={portalSlug}
      />

      {/* From Organizations You Follow */}
      <ExpandableSection
        title={SECTION_CONFIG.followedOrganizations.title}
        icon={SECTION_CONFIG.followedOrganizations.icon}
        count={grouped.followedOrganizations.length}
        accentColor={SECTION_CONFIG.followedOrganizations.color}
        contextType="producer"
        events={grouped.followedOrganizations}
        portalSlug={portalSlug}
      />

      {/* In Your Neighborhoods */}
      <ExpandableSection
        title={SECTION_CONFIG.yourNeighborhoods.title}
        icon={SECTION_CONFIG.yourNeighborhoods.icon}
        count={grouped.yourNeighborhoods.length}
        accentColor={SECTION_CONFIG.yourNeighborhoods.color}
        contextType="neighborhood"
        events={grouped.yourNeighborhoods}
        portalSlug={portalSlug}
      />

      {/* Empty state - all caught up */}
      {!hasSections && hasPreferences && (
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
            href={`/${portalSlug}/events`}
            className="inline-flex items-center gap-2 text-[var(--coral)] font-mono text-sm hover:text-[var(--rose)] transition-colors"
          >
            Browse all events
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      )}

      {/* Show trending as fallback when few personalized events */}
      {hasSections && trendingEvents.length > 0 && filteredEvents.length < 10 && (
        <ExpandableSection
          title={SECTION_CONFIG.trending.title}
          icon={SECTION_CONFIG.trending.icon}
          count={trendingEvents.length}
          accentColor={SECTION_CONFIG.trending.color}
          events={trendingEvents}
          portalSlug={portalSlug}
          initialVisible={3}
        />
      )}
    </div>
  );
}
