"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { formatTime } from "@/lib/formats";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import CategoryIcon, { getCategoryColor } from "./CategoryIcon";
import ReasonBadge, { getTopReasons, type RecommendationReason } from "./ReasonBadge";

type PickEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_free: boolean;
  category: string | null;
  image_url: string | null;
  venue: {
    name: string;
    neighborhood: string | null;
  } | null;
  score?: number;
  reasons?: RecommendationReason[];
};

interface YourPicksRowProps {
  portalSlug: string;
}

function getSmartDate(date: string): string {
  const eventDate = parseISO(date);
  if (isToday(eventDate)) return "Today";
  if (isTomorrow(eventDate)) return "Tomorrow";
  return format(eventDate, "EEE, MMM d");
}

export default function YourPicksRow({ portalSlug }: YourPicksRowProps) {
  const { user, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<PickEvent[]>([]);
  const [hasPreferences, setHasPreferences] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const cardWidth = 220; // Compact card width
  const gap = 12;

  // Update scroll state
  const updateScrollState = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollWidth > clientWidth && scrollLeft < scrollWidth - clientWidth - 10);
  }, []);

  // Fetch personalized events
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchPicks = async () => {
      try {
        const res = await fetch(`/api/feed?portal=${portalSlug}&limit=8`);
        if (!res.ok) {
          throw new Error("Failed to fetch picks");
        }
        const data = await res.json();

        // Only show events with scores (personalized)
        const scoredEvents = (data.events || []).filter(
          (e: PickEvent) => e.score && e.score > 0
        );

        setEvents(scoredEvents.slice(0, 6));
        setHasPreferences(data.hasPreferences || false);
        setError(false);
      } catch (err) {
        console.error("Failed to fetch your picks:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPicks();
  }, [user, authLoading, portalSlug]);

  // Set up scroll listeners
  useEffect(() => {
    if (!scrollRef.current) return;

    updateScrollState();
    const el = scrollRef.current;
    el.addEventListener("scroll", updateScrollState, { passive: true });

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      resizeObserver.disconnect();
    };
  }, [updateScrollState, events]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -(cardWidth + gap) : cardWidth + gap,
      behavior: "smooth",
    });
  };

  // Don't show if not logged in or still loading
  if (authLoading || !user) {
    return null;
  }

  // Show loading skeleton
  if (loading) {
    return (
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="h-5 w-28 rounded skeleton-shimmer" />
        </div>
        <div className="flex gap-3 overflow-hidden -mx-4 px-4">
          {[...Array(4)].map((_, j) => (
            <div
              key={j}
              className="flex-shrink-0 w-[220px] h-28 rounded-xl skeleton-shimmer"
              style={{ animationDelay: `${j * 0.1}s` }}
            />
          ))}
        </div>
      </section>
    );
  }

  // Error state - just hide
  if (error) {
    return null;
  }

  // No scored events - show CTA to set preferences
  if (events.length === 0) {
    if (!hasPreferences) {
      return (
        <section className="mb-8">
          <Link
            href={`/${portalSlug}/preferences`}
            className="flex items-center gap-4 p-4 rounded-xl border border-dashed border-[var(--twilight)] hover:border-[var(--coral)]/50 transition-colors group"
            style={{ backgroundColor: "var(--card-bg)" }}
          >
            <div className="w-10 h-10 rounded-full bg-[var(--coral)]/15 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors">
                Personalize your feed
              </h3>
              <p className="font-mono text-xs text-[var(--muted)] mt-0.5">
                Tell us what you like to see curated picks
              </p>
            </div>
            <svg className="w-5 h-5 text-[var(--muted)] group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </section>
      );
    }
    return null;
  }

  return (
    <section className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          <h3 className="text-sm font-semibold text-[var(--cream)]">Your Picks</h3>
        </div>
        <Link
          href={`/${portalSlug}?view=for-you`}
          className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-mono text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50 transition-colors group"
        >
          See all
          <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Carousel container */}
      <div className="relative -mx-4">
        {/* Scroll buttons */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-[var(--night)] border border-[var(--twilight)] items-center justify-center text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors "
            aria-label="Scroll left"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-[var(--night)] border border-[var(--twilight)] items-center justify-center text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors "
            aria-label="Scroll right"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Cards */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory px-4 scroll-smooth"
        >
          {events.map((event) => (
            <PickCard key={event.id} event={event} portalSlug={portalSlug} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PickCard({ event, portalSlug }: { event: PickEvent; portalSlug: string }) {
  const [imageError, setImageError] = useState(false);
  const categoryColor = event.category ? getCategoryColor(event.category) : null;
  const topReason = getTopReasons(event.reasons, 1)[0];

  return (
    <Link
      href={`/${portalSlug}?event=${event.id}`}
      scroll={false}
      className="flex-shrink-0 w-[220px] snap-start rounded-xl overflow-hidden border border-[var(--twilight)] hover:border-[var(--coral)]/30 transition-all group"
      style={{ backgroundColor: "var(--card-bg)" }}
    >
      <div className="flex h-full">
        {/* Image or category fallback */}
        <div
          className="w-20 flex-shrink-0 relative overflow-hidden"
          style={{ backgroundColor: categoryColor ? `${categoryColor}15` : "var(--twilight)" }}
        >
          {event.image_url && !imageError ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={event.image_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              onError={() => setImageError(true)}
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              {event.category ? (
                <CategoryIcon type={event.category} size={24} glow="subtle" />
              ) : (
                <svg className="w-6 h-6 text-[var(--muted)] opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-2.5 flex flex-col justify-between min-w-0">
          <div>
            {/* Title */}
            <h4 className="text-xs font-medium text-[var(--cream)] line-clamp-2 group-hover:text-[var(--coral)] transition-colors leading-snug">
              {event.title}
            </h4>

            {/* Date/Time */}
            <p className="font-mono text-[0.55rem] text-[var(--muted)] mt-1">
              {getSmartDate(event.start_date)}
              {event.start_time && ` · ${formatTime(event.start_time)}`}
            </p>
          </div>

          {/* Reason badge */}
          {topReason && (
            <div className="mt-2">
              <ReasonBadge reason={topReason} size="sm" />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
