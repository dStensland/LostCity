"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import EventCard, { type FriendGoing } from "@/components/EventCard";
import CollapsibleSection from "@/components/CollapsibleSection";
import type { RecommendationReason } from "@/components/ReasonBadge";

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

// Section configuration with icons and colors
const SECTION_CONFIG = {
  yourInterests: {
    title: "Based on Your Interests",
    icon: "✨",
    color: "#00FFFF", // cyan
  },
  followedVenues: {
    title: "From Venues You Follow",
    icon: "📍",
    color: "#FF00FF", // magenta
  },
  followedOrgs: {
    title: "From Orgs You Follow",
    icon: "🎭",
    color: "#FFD700", // gold
  },
  yourNeighborhoods: {
    title: "In Your Neighborhoods",
    icon: "🗺️",
    color: "#FFA500", // orange
  },
  trending: {
    title: "Trending This Week",
    icon: "🔥",
    color: "#FF6B6B", // coral
  },
} as const;

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
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [trendingEvents, setTrendingEvents] = useState<TrendingEvent[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPreferences, setHasPreferences] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const loadFeed = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      const [feedRes, trendingRes, prefsRes] = await Promise.all([
        fetch(`/api/feed?limit=50&portal=${portalSlug}`),
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
          eventsWithProducerReason: feedData.events?.filter((e: FeedEvent) =>
            e.reasons?.some((r) => r.type === "followed_producer")
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

  // Group events by section
  const grouped = useMemo(() => {
    const seenEventIds = new Set<number>();

    // Events matching user's favorite categories (that don't have a more specific reason)
    const yourInterests = events.filter((e) => {
      if (!preferences?.favorite_categories?.length) return false;
      if (!e.category) return false;
      // Only include if category matches AND doesn't have a follow-based reason
      const hasFollowReason = e.reasons?.some(
        (r) => r.type === "followed_venue" || r.type === "followed_producer"
      );
      return preferences.favorite_categories.includes(e.category) && !hasFollowReason;
    });

    // Events from followed venues
    const followedVenues = events.filter((e) =>
      e.reasons?.some((r) => r.type === "followed_venue")
    );

    // Events from followed orgs/producers
    const followedOrgs = events.filter((e) =>
      e.reasons?.some((r) => r.type === "followed_producer")
    );

    // Events in user's favorite neighborhoods (that aren't in other sections)
    const yourNeighborhoods = events.filter((e) => {
      if (!preferences?.favorite_neighborhoods?.length) return false;
      if (!e.venue?.neighborhood) return false;
      // Only include if not already in a more specific section
      const hasFollowReason = e.reasons?.some(
        (r) => r.type === "followed_venue" || r.type === "followed_producer"
      );
      const matchesCategory = preferences?.favorite_categories?.includes(e.category || "");
      return (
        preferences.favorite_neighborhoods.includes(e.venue.neighborhood) &&
        !hasFollowReason &&
        !matchesCategory
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
      yourInterests: dedupeSection(yourInterests).slice(0, 6),
      followedVenues: dedupeSection(followedVenues).slice(0, 6),
      followedOrgs: dedupeSection(followedOrgs).slice(0, 6),
      yourNeighborhoods: dedupeSection(yourNeighborhoods).slice(0, 6),
    };
  }, [events, preferences]);

  // Check if any sections have content
  const hasSections =
    grouped.yourInterests.length > 0 ||
    grouped.followedVenues.length > 0 ||
    grouped.followedOrgs.length > 0 ||
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
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--neon-cyan)]/20 to-[var(--neon-magenta)]/20 flex items-center justify-center">
            <span className="text-3xl">✨</span>
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

        {/* Show trending as fallback */}
        {trendingEvents.length > 0 && (
          <CollapsibleSection
            title={SECTION_CONFIG.trending.title}
            icon={SECTION_CONFIG.trending.icon}
            count={trendingEvents.length}
            accentColor={SECTION_CONFIG.trending.color}
            defaultOpen
          >
            <div>
              {trendingEvents.slice(0, 6).map((event, idx) => (
                <EventCard
                  key={event.id}
                  event={event as never}
                  index={idx}
                  portalSlug={portalSlug}
                  skipAnimation
                />
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    );
  }

  // Main content with sections
  return (
    <div className="space-y-4">
      {/* Based on Your Interests */}
      {grouped.yourInterests.length > 0 && (
        <CollapsibleSection
          title={SECTION_CONFIG.yourInterests.title}
          icon={SECTION_CONFIG.yourInterests.icon}
          count={grouped.yourInterests.length}
          accentColor={SECTION_CONFIG.yourInterests.color}
          defaultOpen
        >
          <div>
            {grouped.yourInterests.map((event, idx) => (
              <EventCard
                key={event.id}
                event={event as never}
                index={idx}
                portalSlug={portalSlug}
                reasons={event.reasons}
                friendsGoing={convertFriendsGoing(event.friends_going)}
                skipAnimation
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* From Venues You Follow */}
      {grouped.followedVenues.length > 0 && (
        <CollapsibleSection
          title={SECTION_CONFIG.followedVenues.title}
          icon={SECTION_CONFIG.followedVenues.icon}
          count={grouped.followedVenues.length}
          accentColor={SECTION_CONFIG.followedVenues.color}
          defaultOpen
        >
          <div>
            {grouped.followedVenues.map((event, idx) => (
              <EventCard
                key={event.id}
                event={event as never}
                index={idx}
                portalSlug={portalSlug}
                reasons={event.reasons}
                friendsGoing={convertFriendsGoing(event.friends_going)}
                skipAnimation
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* From Orgs You Follow */}
      {grouped.followedOrgs.length > 0 && (
        <CollapsibleSection
          title={SECTION_CONFIG.followedOrgs.title}
          icon={SECTION_CONFIG.followedOrgs.icon}
          count={grouped.followedOrgs.length}
          accentColor={SECTION_CONFIG.followedOrgs.color}
          defaultOpen
        >
          <div>
            {grouped.followedOrgs.map((event, idx) => (
              <EventCard
                key={event.id}
                event={event as never}
                index={idx}
                portalSlug={portalSlug}
                reasons={event.reasons}
                friendsGoing={convertFriendsGoing(event.friends_going)}
                skipAnimation
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* In Your Neighborhoods */}
      {grouped.yourNeighborhoods.length > 0 && (
        <CollapsibleSection
          title={SECTION_CONFIG.yourNeighborhoods.title}
          icon={SECTION_CONFIG.yourNeighborhoods.icon}
          count={grouped.yourNeighborhoods.length}
          accentColor={SECTION_CONFIG.yourNeighborhoods.color}
          defaultOpen={grouped.yourInterests.length === 0 && grouped.followedVenues.length === 0}
        >
          <div>
            {grouped.yourNeighborhoods.map((event, idx) => (
              <EventCard
                key={event.id}
                event={event as never}
                index={idx}
                portalSlug={portalSlug}
                reasons={event.reasons}
                friendsGoing={convertFriendsGoing(event.friends_going)}
                skipAnimation
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

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
      {hasSections && trendingEvents.length > 0 && events.length < 10 && (
        <CollapsibleSection
          title={SECTION_CONFIG.trending.title}
          icon={SECTION_CONFIG.trending.icon}
          count={trendingEvents.length}
          accentColor={SECTION_CONFIG.trending.color}
          defaultOpen={false}
        >
          <div>
            {trendingEvents.slice(0, 6).map((event, idx) => (
              <EventCard
                key={event.id}
                event={event as never}
                index={idx}
                portalSlug={portalSlug}
                skipAnimation
              />
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
