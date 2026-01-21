"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ActivityFeed from "@/components/ActivityFeed";
import CategoryIcon from "@/components/CategoryIcon";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
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

type FeedTab = "activity" | "events";

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

export default function ForYouPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<FeedTab>("events");
  const [events, setEvents] = useState<Event[]>([]);
  const [trendingEvents, setTrendingEvents] = useState<TrendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPreferences, setHasPreferences] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load personalized events and trending
  const loadFeed = useCallback(async (signal: AbortSignal) => {
    try {
      setError(null);

      // Fetch both in parallel
      const [feedRes, trendingRes] = await Promise.all([
        fetch("/api/feed?limit=20", { signal }),
        fetch("/api/trending?limit=6", { signal }),
      ]);

      if (!feedRes.ok) {
        throw new Error("Failed to load feed");
      }

      const feedData = await feedRes.json();
      const trendingData = trendingRes.ok ? await trendingRes.json() : { events: [] };

      if (!signal.aborted) {
        setEvents(feedData.events || []);
        setHasPreferences(feedData.hasPreferences);
        setTrendingEvents(trendingData.events || []);
        setLoading(false);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      console.error("Failed to load feed:", err);
      if (!signal.aborted) {
        setError("Failed to load feed");
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // Don't do anything while auth is loading
    if (authLoading) return;

    // Redirect if not logged in
    if (!user) {
      router.push("/auth/login?redirect=/foryou");
      return;
    }

    // User is logged in, load the feed
    const controller = new AbortController();
    loadFeed(controller.signal);

    return () => controller.abort();
  }, [user, authLoading, router, loadFeed]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    // Show loading while redirect happens
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <PageHeader showSpots />

      {/* Main */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Page title */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-serif text-2xl text-[var(--cream)] italic">For You</h1>
          {!hasPreferences && (
            <Link
              href="/settings/preferences"
              className="font-mono text-xs text-[var(--coral)] hover:text-[var(--rose)] transition-colors"
            >
              Set preferences
            </Link>
          )}
        </div>

        {/* No preferences banner */}
        {!hasPreferences && !loading && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)]">
            <p className="text-[var(--soft)] text-sm">
              Set your preferences to get personalized event recommendations.
            </p>
            <Link
              href="/settings/preferences"
              className="inline-block mt-2 px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-xs font-medium rounded-lg hover:bg-[var(--rose)] transition-colors"
            >
              Set Preferences
            </Link>
          </div>
        )}

        {/* Trending This Week */}
        {!loading && trendingEvents.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <h2 className="font-mono text-sm font-medium text-[var(--cream)] uppercase tracking-wider">
                Trending This Week
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {trendingEvents.slice(0, 4).map((event) => (
                <TrendingCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        )}

        {/* Tab toggle */}
        <div className="flex gap-1 p-1 bg-[var(--night)] rounded-lg mb-6">
          <button
            onClick={() => setTab("events")}
            className={`flex-1 px-4 py-2 rounded-md font-mono text-xs font-medium transition-colors ${
              tab === "events"
                ? "bg-[var(--dusk)] text-[var(--cream)]"
                : "text-[var(--muted)] hover:text-[var(--cream)]"
            }`}
          >
            Suggested Events
          </button>
          <button
            onClick={() => setTab("activity")}
            className={`flex-1 px-4 py-2 rounded-md font-mono text-xs font-medium transition-colors ${
              tab === "activity"
                ? "bg-[var(--dusk)] text-[var(--cream)]"
                : "text-[var(--muted)] hover:text-[var(--cream)]"
            }`}
          >
            Friend Activity
          </button>
        </div>

        {/* Content */}
        {tab === "events" ? (
          loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg animate-pulse"
                >
                  <div className="h-5 bg-[var(--twilight)] rounded w-3/4 mb-2" />
                  <div className="h-4 bg-[var(--twilight)] rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : error ? (
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
          ) : events.length === 0 ? (
            <div className="p-6 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg text-center">
              <p className="text-[var(--soft)] font-mono text-sm">No events found</p>
              <p className="text-[var(--muted)] font-mono text-xs mt-1">
                Try updating your preferences or check back later
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )
        ) : (
          <ActivityFeed limit={20} />
        )}
      </main>
    </div>
  );
}

function EventCard({ event }: { event: Event }) {
  const dateObj = parseISO(event.start_date);
  const formattedDate = format(dateObj, "EEE, MMM d");
  const time = formatTime(event.start_time, event.is_all_day);

  // Get primary recommendation reason
  const primaryReason = event.reasons?.[0];

  // Get icon for reason type
  const getReasonIcon = (type: string) => {
    switch (type) {
      case "friends_going":
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        );
      case "followed_venue":
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case "followed_producer":
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        );
      case "neighborhood":
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        );
      case "vibes":
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        );
      case "price":
        return (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  // Get color for reason type
  const getReasonColor = (type: string) => {
    switch (type) {
      case "friends_going":
        return "text-[var(--coral)]";
      case "followed_venue":
      case "followed_producer":
        return "text-[#A78BFA]";
      case "neighborhood":
        return "text-[#6EE7B7]";
      case "vibes":
        return "text-[#F9A8D4]";
      case "price":
        return "text-[#FBBF24]";
      default:
        return "text-[var(--muted)]";
    }
  };

  return (
    <Link
      href={`/events/${event.id}`}
      className="block p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg hover:border-[var(--coral)]/30 transition-all group card-event-hover"
    >
      {/* Recommendation reason badge */}
      {primaryReason && (
        <div className={`flex items-center gap-1.5 mb-2 ${getReasonColor(primaryReason.type)}`}>
          {getReasonIcon(primaryReason.type)}
          <span className="font-mono text-xs">
            {primaryReason.detail ? `${primaryReason.label}: ${primaryReason.detail}` : primaryReason.label}
          </span>
        </div>
      )}

      <div className="flex gap-4">
        {/* Image thumbnail */}
        {event.image_url && (
          <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--night)] relative">
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
            <div className="mb-1">
              <CategoryIcon type={event.category} size={12} showLabel />
            </div>
          )}

          {/* Title */}
          <h3 className="font-semibold text-[var(--cream)] line-clamp-2 group-hover:text-[var(--coral)] transition-colors">
            {event.title}
          </h3>

          {/* Venue */}
          {event.venue && (
            <p className="font-serif text-sm text-[var(--soft)] mt-0.5 truncate">
              {event.venue.name}
            </p>
          )}

          {/* Date/time */}
          <p className="font-mono text-xs text-[var(--muted)] mt-1">
            {formattedDate} · {time}
            {event.is_free && (
              <span className="ml-2 text-[var(--cat-community)]">Free</span>
            )}
          </p>

          {/* Friends going avatars */}
          {event.friends_going && event.friends_going.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex -space-x-2">
                {event.friends_going.slice(0, 3).map((friend) => (
                  <div
                    key={friend.user_id}
                    className="w-6 h-6 rounded-full bg-[var(--coral)] flex items-center justify-center text-[var(--void)] text-[10px] font-bold border-2 border-[var(--dusk)]"
                    title={friend.display_name || `@${friend.username}`}
                  >
                    {(friend.display_name || friend.username).charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
              <span className="font-mono text-xs text-[var(--soft)]">
                {event.friends_going.length === 1
                  ? `${event.friends_going[0].display_name || `@${event.friends_going[0].username}`} is going`
                  : `${event.friends_going.length} friends going`}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function TrendingCard({ event }: { event: TrendingEvent }) {
  const dateObj = parseISO(event.start_date);
  const formattedDate = format(dateObj, "EEE, MMM d");
  const time = formatTime(event.start_time, event.is_all_day);

  return (
    <Link
      href={`/events/${event.id}`}
      className="block p-3 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg hover:border-[var(--coral)]/30 transition-all group card-event-hover"
    >
      {/* Image */}
      {event.image_url && (
        <div className="w-full aspect-[4/3] rounded-lg overflow-hidden bg-[var(--night)] relative mb-2">
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            className="object-cover"
          />
          {/* Trending badge */}
          {event.rsvp_count > 0 && (
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--void)]/80 backdrop-blur-sm">
              <svg className="w-3 h-3 text-[var(--coral)]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
              </svg>
              <span className="font-mono text-[10px] text-[var(--coral)] font-medium">
                {event.rsvp_count}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Category */}
      {event.category && (
        <div className="mb-1">
          <CategoryIcon type={event.category} size={10} showLabel />
        </div>
      )}

      {/* Title */}
      <h3 className="font-semibold text-sm text-[var(--cream)] line-clamp-2 group-hover:text-[var(--coral)] transition-colors">
        {event.title}
      </h3>

      {/* Venue */}
      {event.venue && (
        <p className="font-serif text-xs text-[var(--soft)] mt-0.5 truncate">
          {event.venue.name}
        </p>
      )}

      {/* Date/time */}
      <p className="font-mono text-[10px] text-[var(--muted)] mt-1">
        {formattedDate} · {time}
      </p>
    </Link>
  );
}

