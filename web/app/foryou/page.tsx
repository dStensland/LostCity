"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import UserMenu from "@/components/UserMenu";
import CategoryIcon from "@/components/CategoryIcon";
import ActivityFeed from "@/components/ActivityFeed";
import { useAuth } from "@/lib/auth-context";
import { format, parseISO } from "date-fns";
import { formatTime } from "@/lib/formats";

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
};

type FeedTab = "activity" | "events";

export default function ForYouPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<FeedTab>("events");
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPreferences, setHasPreferences] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load personalized events
  const loadFeed = useCallback(async (signal: AbortSignal) => {
    try {
      setError(null);
      const res = await fetch("/api/feed?limit=20", { signal });
      if (!res.ok) {
        throw new Error("Failed to load feed");
      }
      const data = await res.json();
      if (!signal.aborted) {
        setEvents(data.events || []);
        setHasPreferences(data.hasPreferences);
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
      {/* Header */}
      <header className="px-4 sm:px-6 py-4 flex justify-between items-center border-b border-[var(--twilight)]">
        <div className="flex items-baseline gap-3">
          <Logo />
          <span className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest hidden sm:inline">
            Atlanta
          </span>
        </div>
        <nav className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/"
            className="font-mono text-[0.7rem] font-medium text-[var(--muted)] uppercase tracking-wide hover:text-[var(--cream)] transition-colors"
          >
            Events
          </Link>
          <Link
            href="/spots"
            className="font-mono text-[0.7rem] font-medium text-[var(--muted)] uppercase tracking-wide hover:text-[var(--cream)] transition-colors"
          >
            Spots
          </Link>
          <UserMenu />
        </nav>
      </header>

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

  return (
    <Link
      href={`/events/${event.id}`}
      className="block p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg hover:bg-[var(--twilight)] transition-colors group"
    >
      <div className="flex gap-4">
        {/* Image thumbnail */}
        {event.image_url && (
          <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--night)]">
            <img
              src={event.image_url}
              alt={event.title}
              className="w-full h-full object-cover"
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
        </div>
      </div>
    </Link>
  );
}

