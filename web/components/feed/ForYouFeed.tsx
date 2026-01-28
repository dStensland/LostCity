"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import CategoryIcon from "@/components/CategoryIcon";
import CollapsibleSection from "@/components/CollapsibleSection";
import { format, parseISO } from "date-fns";
import { formatTime } from "@/lib/formats";

type RecommendationReason = {
  type: "followed_venue" | "followed_producer" | "neighborhood" | "vibes" | "price" | "friends_going" | "trending";
  label: string;
  detail?: string;
};

type FriendGoing = {
  user_id: string;
  username: string;
  display_name: string | null;
};

type Event = {
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
  } | null;
  score?: number;
  reasons?: RecommendationReason[];
  friends_going?: FriendGoing[];
};

type UserPreferences = {
  favorite_categories: string[];
  favorite_neighborhoods: string[];
  favorite_vibes: string[];
  price_preference: string | null;
};

type TrendingEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  price_min: number | null;
  category: string | null;
  image_url: string | null;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
  } | null;
  rsvp_count: number;
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

export default function ForYouFeed({ portalSlug }: ForYouFeedProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [trendingEvents, setTrendingEvents] = useState<TrendingEvent[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPreferences, setHasPreferences] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(async (signal: AbortSignal) => {
    try {
      setError(null);

      const [feedRes, trendingRes, prefsRes] = await Promise.all([
        fetch(`/api/feed?limit=50&portal=${portalSlug}`, { signal }),
        fetch(`/api/trending?limit=10&portal=${portalSlug}`, { signal }),
        fetch(`/api/preferences`, { signal }),
      ]);

      if (!feedRes.ok) {
        const errorData = await feedRes.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to load feed (${feedRes.status})`);
      }

      const feedData = await feedRes.json();
      const trendingData = trendingRes.ok ? await trendingRes.json() : { events: [] };
      const prefsData = prefsRes.ok ? await prefsRes.json() : null;

      if (!signal.aborted) {
        setEvents(feedData.events || []);
        setHasPreferences(feedData.hasPreferences);
        setTrendingEvents(trendingData.events || []);
        setPreferences(prefsData);
        setLoading(false);
      }
    } catch (err) {
      if (
        signal.aborted ||
        (err instanceof Error && (err.name === "AbortError" || err.message.includes("aborted")))
      ) {
        return;
      }
      console.error("Failed to load feed:", err);
      setError("Failed to load feed");
      setLoading(false);
    }
  }, [portalSlug]);

  useEffect(() => {
    // FeedShell already gates this component behind auth check,
    // so we can safely load the feed when mounted
    const controller = new AbortController();
    loadFeed(controller.signal);

    return () => controller.abort();
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
    const dedupeSection = (sectionEvents: Event[]): Event[] => {
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
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl overflow-hidden bg-[var(--dusk)] border border-[var(--twilight)]">
            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 skeleton-shimmer rounded-lg" />
              <div className="flex-1">
                <div className="h-4 skeleton-shimmer rounded w-40 mb-2" />
                <div className="h-3 skeleton-shimmer rounded w-24" />
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
          onClick={() => {
            setLoading(true);
            const controller = new AbortController();
            loadFeed(controller.signal);
          }}
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
            <div className="space-y-3">
              {trendingEvents.slice(0, 6).map((event) => (
                <TrendingEventCard key={event.id} event={event} />
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
          <div className="space-y-3">
            {grouped.yourInterests.map((event) => (
              <EventCard key={event.id} event={event} />
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
          <div className="space-y-3">
            {grouped.followedVenues.map((event) => (
              <EventCard key={event.id} event={event} showReason />
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
          <div className="space-y-3">
            {grouped.followedOrgs.map((event) => (
              <EventCard key={event.id} event={event} showReason />
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
          <div className="space-y-3">
            {grouped.yourNeighborhoods.map((event) => (
              <EventCard key={event.id} event={event} />
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
          <div className="space-y-3">
            {trendingEvents.slice(0, 6).map((event) => (
              <TrendingEventCard key={event.id} event={event} />
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// Event card component
function EventCard({ event, showReason = false }: { event: Event; showReason?: boolean }) {
  const dateObj = parseISO(event.start_date);
  const formattedDate = format(dateObj, "EEE, MMM d");
  const time = formatTime(event.start_time, event.is_all_day);

  const primaryReason = event.reasons?.[0];

  return (
    <Link
      href={`/events/${event.id}`}
      className="flex gap-3 p-3 rounded-lg bg-[var(--night)]/50 hover:bg-[var(--night)] border border-transparent hover:border-[var(--twilight)] transition-all group"
    >
      {/* Image thumbnail */}
      {event.image_url && (
        <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--night)] relative">
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            className="object-cover"
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Category */}
        {event.category && (
          <div className="mb-0.5">
            <CategoryIcon type={event.category} size={10} showLabel />
          </div>
        )}

        {/* Title */}
        <h3 className="font-semibold text-sm text-[var(--cream)] line-clamp-1 group-hover:text-[var(--coral)] transition-colors">
          {event.title}
        </h3>

        {/* Venue with reason badge */}
        <div className="flex items-center gap-2 mt-0.5">
          {event.venue && (
            <p className="font-serif text-xs text-[var(--soft)] truncate">
              {event.venue.name}
            </p>
          )}
          {showReason && primaryReason && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-[#A78BFA]/15 text-[#A78BFA]">
              Following
            </span>
          )}
        </div>

        {/* Date/time */}
        <p className="font-mono text-[10px] text-[var(--muted)] mt-0.5">
          {formattedDate} · {time}
          {event.is_free && (
            <span className="ml-2 text-[var(--cat-community)]">Free</span>
          )}
        </p>

        {/* Friends going avatars */}
        {event.friends_going && event.friends_going.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <div className="flex -space-x-1.5">
              {event.friends_going.slice(0, 3).map((friend) => (
                <div
                  key={friend.user_id}
                  className="w-5 h-5 rounded-full bg-[var(--coral)] flex items-center justify-center text-[var(--void)] text-[8px] font-bold border border-[var(--dusk)]"
                  title={friend.display_name || `@${friend.username}`}
                >
                  {(friend.display_name || friend.username).charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
            <span className="font-mono text-[9px] text-[var(--soft)]">
              {event.friends_going.length === 1
                ? `${event.friends_going[0].display_name || `@${event.friends_going[0].username}`} going`
                : `${event.friends_going.length} friends`}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

// Trending event card component
function TrendingEventCard({ event }: { event: TrendingEvent }) {
  const dateObj = parseISO(event.start_date);
  const formattedDate = format(dateObj, "EEE, MMM d");
  const time = formatTime(event.start_time, event.is_all_day);

  return (
    <Link
      href={`/events/${event.id}`}
      className="flex gap-3 p-3 rounded-lg bg-[var(--night)]/50 hover:bg-[var(--night)] border border-transparent hover:border-[var(--twilight)] transition-all group"
    >
      {/* Image thumbnail */}
      {event.image_url && (
        <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--night)] relative">
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            className="object-cover"
          />
          {/* Trending badge */}
          {event.rsvp_count > 0 && (
            <div className="absolute bottom-1 right-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[var(--void)]/80 backdrop-blur-sm">
              <svg className="w-2.5 h-2.5 text-[var(--coral)]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
              </svg>
              <span className="font-mono text-[8px] text-[var(--coral)] font-medium">
                {event.rsvp_count}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Category */}
        {event.category && (
          <div className="mb-0.5">
            <CategoryIcon type={event.category} size={10} showLabel />
          </div>
        )}

        {/* Title */}
        <h3 className="font-semibold text-sm text-[var(--cream)] line-clamp-1 group-hover:text-[var(--coral)] transition-colors">
          {event.title}
        </h3>

        {/* Venue */}
        {event.venue && (
          <p className="font-serif text-xs text-[var(--soft)] mt-0.5 truncate">
            {event.venue.name}
          </p>
        )}

        {/* Date/time */}
        <p className="font-mono text-[10px] text-[var(--muted)] mt-0.5">
          {formattedDate} · {time}
          {event.is_free && (
            <span className="ml-2 text-[var(--cat-community)]">Free</span>
          )}
        </p>
      </div>
    </Link>
  );
}
