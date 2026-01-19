"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { usePortal } from "@/lib/portal-context";
import ActivityFeed from "./ActivityFeed";
import CategoryIcon, { getCategoryColor } from "./CategoryIcon";
import { formatTime } from "@/lib/formats";
import { format, parseISO } from "date-fns";

type FeedEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  category: string | null;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
  } | null;
};

type FeedSection = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  section_type: "auto" | "curated" | "mixed";
  events: FeedEvent[];
};

type FeedTab = "foryou" | "activity";

export default function FeedView() {
  const { user, loading: authLoading } = useAuth();
  const { portal } = usePortal();

  const [tab, setTab] = useState<FeedTab>("foryou");
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [sections, setSections] = useState<FeedSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPreferences, setHasPreferences] = useState(false);

  // Get feed settings from portal
  const feedSettings = (portal.settings?.feed || {}) as {
    feed_type?: "default" | "sections" | "custom";
    show_activity_tab?: boolean;
    featured_section_ids?: string[];
    items_per_section?: number;
  };
  const feedType = feedSettings.feed_type || "default";
  const showActivityTab = feedSettings.show_activity_tab !== false;

  const loadFeed = useCallback(async (signal: AbortSignal) => {
    try {
      // If portal uses sections, fetch from portal feed API
      if (feedType === "sections" || feedType === "custom") {
        const res = await fetch(`/api/portals/${portal.slug}/feed`, { signal });
        if (res.ok) {
          const data = await res.json();
          if (!signal.aborted) {
            setSections(data.sections || []);
          }
        }
      }

      // For default or custom feed, also load personalized events
      if (feedType === "default" || feedType === "custom") {
        const res = await fetch("/api/feed?limit=20", { signal });
        if (!res.ok) throw new Error("Failed to load feed");
        const data = await res.json();
        if (!signal.aborted) {
          setEvents(data.events || []);
          setHasPreferences(data.hasPreferences);
        }
      }

      if (!signal.aborted) {
        setLoading(false);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Failed to load feed:", err);
      if (!signal.aborted) setLoading(false);
    }
  }, [feedType, portal.slug]);

  useEffect(() => {
    if (authLoading) return;

    // For section-based feeds, we don't require auth
    if (feedType === "sections") {
      const controller = new AbortController();
      loadFeed(controller.signal);
      return () => controller.abort();
    }

    // For default/custom feeds, require auth
    if (!user) return;

    const controller = new AbortController();
    loadFeed(controller.signal);
    return () => controller.abort();
  }, [user, authLoading, loadFeed, feedType]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // For section-based feeds that don't require auth
  if (!user && feedType !== "sections") {
    return (
      <div className="py-16 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
        <h2 className="text-lg text-[var(--cream)] mb-2">Your Personal Feed</h2>
        <p className="text-[var(--muted)] text-sm max-w-xs mx-auto mb-4">
          Sign in to get personalized event recommendations and see what your friends are up to.
        </p>
        <Link
          href="/auth/login"
          className="inline-block px-4 py-2 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
        >
          Sign In
        </Link>
      </div>
    );
  }

  // Render event card helper
  const renderEventCard = (event: FeedEvent) => {
    const categoryColor = event.category ? getCategoryColor(event.category) : null;
    return (
      <Link
        key={event.id}
        href={`/events/${event.id}`}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[var(--twilight)] bg-[var(--dusk)]/30 hover:bg-[var(--dusk)]/60 transition-colors group"
        style={{
          borderLeftWidth: categoryColor ? "3px" : undefined,
          borderLeftColor: categoryColor || undefined,
        }}
      >
        {/* Time */}
        <div className="flex-shrink-0 w-12 font-mono text-sm text-[var(--soft)] text-center">
          {formatTime(event.start_time)}
        </div>

        {/* Category icon */}
        {event.category && (
          <CategoryIcon type={event.category} size={16} className="flex-shrink-0 opacity-60" />
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-[var(--cream)] truncate group-hover:text-[var(--neon-magenta)] transition-colors">
            {event.title}
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[0.65rem] text-[var(--muted)]">
            <span>{format(parseISO(event.start_date), "EEE, MMM d")}</span>
            {event.venue && (
              <>
                <span className="opacity-40">·</span>
                <span className="truncate">{event.venue.name}</span>
              </>
            )}
          </div>
        </div>

        {/* Free badge */}
        {event.is_free && (
          <span className="flex-shrink-0 px-1.5 py-0.5 text-[0.55rem] font-mono font-medium bg-[var(--neon-green)]/20 text-[var(--neon-green)] rounded">
            FREE
          </span>
        )}
      </Link>
    );
  };

  // Render sections
  const renderSections = () => (
    <div className="space-y-8">
      {sections.map((section) => (
        <div key={section.id}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-serif text-lg text-[var(--cream)]">{section.title}</h3>
              {section.description && (
                <p className="font-mono text-xs text-[var(--muted)] mt-0.5">{section.description}</p>
              )}
            </div>
            <span className="px-2 py-0.5 rounded text-[0.55rem] font-mono bg-[var(--twilight)] text-[var(--muted)]">
              {section.section_type}
            </span>
          </div>
          {section.events.length > 0 ? (
            <div className="space-y-2">
              {section.events.map(renderEventCard)}
            </div>
          ) : (
            <div className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg text-center">
              <p className="font-mono text-xs text-[var(--muted)]">No events in this section</p>
            </div>
          )}
        </div>
      ))}
      {sections.length === 0 && !loading && (
        <div className="p-6 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg text-center">
          <p className="text-[var(--soft)] text-sm">No curated content yet</p>
          <p className="text-[var(--muted)] text-xs mt-1">
            Check back later for featured events
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="py-6">
      {/* No preferences banner (only for default/custom with user) */}
      {feedType !== "sections" && user && !hasPreferences && !loading && (
        <div className="mb-6 p-4 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)]">
          <p className="text-[var(--soft)] text-sm">
            Set your preferences to get personalized recommendations.
          </p>
          <Link
            href="/settings/preferences"
            className="inline-block mt-2 px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-xs font-medium rounded-lg hover:bg-[var(--rose)] transition-colors"
          >
            Set Preferences
          </Link>
        </div>
      )}

      {/* Tab toggle - only show if there's activity tab and user is logged in */}
      {showActivityTab && user && feedType !== "sections" && (
        <div className="flex gap-1 p-1 bg-[var(--night)] rounded-lg mb-6">
          <button
            onClick={() => setTab("foryou")}
            className={`flex-1 px-4 py-2 rounded-md font-mono text-xs font-medium transition-colors ${
              tab === "foryou"
                ? "bg-[var(--dusk)] text-[var(--cream)]"
                : "text-[var(--muted)] hover:text-[var(--cream)]"
            }`}
          >
            For You
          </button>
          <button
            onClick={() => setTab("activity")}
            className={`flex-1 px-4 py-2 rounded-md font-mono text-xs font-medium transition-colors ${
              tab === "activity"
                ? "bg-[var(--dusk)] text-[var(--cream)]"
                : "text-[var(--muted)] hover:text-[var(--cream)]"
            }`}
          >
            Friends
          </button>
        </div>
      )}

      {/* Content based on feed type */}
      {feedType === "sections" ? (
        // Section-only feed
        loading ? (
          <div className="space-y-6">
            {[...Array(2)].map((_, i) => (
              <div key={i}>
                <div className="h-6 w-32 bg-[var(--dusk)] rounded animate-pulse mb-3" />
                <div className="space-y-2">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="animate-pulse rounded-lg bg-[var(--dusk)] h-16" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          renderSections()
        )
      ) : feedType === "custom" ? (
        // Hybrid: sections first, then personalized
        loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg bg-[var(--dusk)] h-16" />
            ))}
          </div>
        ) : tab === "foryou" ? (
          <div className="space-y-8">
            {/* Featured sections first */}
            {sections.length > 0 && renderSections()}

            {/* Then personalized recommendations */}
            {events.length > 0 && (
              <div>
                <h3 className="font-serif text-lg text-[var(--cream)] mb-3">
                  Recommended for You
                </h3>
                <div className="space-y-2">
                  {events.map(renderEventCard)}
                </div>
              </div>
            )}

            {sections.length === 0 && events.length === 0 && (
              <div className="p-6 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg text-center">
                <p className="text-[var(--soft)] text-sm">No content yet</p>
                <p className="text-[var(--muted)] text-xs mt-1">
                  Check back later for updates
                </p>
              </div>
            )}
          </div>
        ) : (
          <ActivityFeed limit={20} />
        )
      ) : (
        // Default personalized feed
        tab === "foryou" ? (
          loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-lg bg-[var(--dusk)] h-16" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="p-6 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg text-center">
              <p className="text-[var(--soft)] text-sm">No recommendations yet</p>
              <p className="text-[var(--muted)] text-xs mt-1">
                Try setting your preferences or check back later
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.map(renderEventCard)}
            </div>
          )
        ) : (
          <ActivityFeed limit={20} />
        )
      )}
    </div>
  );
}
