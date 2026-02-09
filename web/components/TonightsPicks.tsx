"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { formatTimeSplit } from "@/lib/formats";
import CategoryIcon, { getCategoryLabel } from "./CategoryIcon";
import CategoryPlaceholder from "./CategoryPlaceholder";
import FeedSectionHeader from "./feed/FeedSectionHeader";

type TonightEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  category: string | null;
  image_url: string | null;
  rsvp_count?: number; // Social proof: how many people are going/interested
  series_id?: string | null;
  series?: {
    id: string;
    slug: string;
    title: string;
    series_type: string;
    image_url: string | null;
    frequency: string | null;
    day_of_week: string | null;
    festival?: {
      id: string;
      slug: string;
      name: string;
      image_url: string | null;
      festival_type?: string | null;
      location: string | null;
      neighborhood: string | null;
    } | null;
  } | null;
  venue: {
    name: string;
    neighborhood: string | null;
  } | null;
};

// Hero image component with loading state and error fallback
function HeroImage({
  src,
  alt,
  category,
  size = "lg",
  loading = "eager",
  overlay = "strong",
}: {
  src: string;
  alt: string;
  category: string | null;
  size?: "sm" | "md" | "lg";
  loading?: "eager" | "lazy";
  overlay?: "strong" | "soft";
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const overlayClass =
    overlay === "soft"
      ? "bg-gradient-to-t from-black/70 via-black/35 to-black/10"
      : "bg-gradient-to-t from-black/95 via-black/60 to-black/20";

  if (error) {
    return <CategoryPlaceholder category={category} size={size} />;
  }

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Shimmer placeholder while loading */}
      {!loaded && (
        <div className="absolute inset-0 skeleton-shimmer" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`absolute inset-0 w-full h-full object-cover sm:transition-transform sm:duration-700 sm:group-hover:scale-105 ${
          loaded ? "opacity-100" : "opacity-0"
        } transition-opacity duration-300`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading={loading}
      />
      <div className={`absolute inset-0 ${overlayClass}`} />
    </div>
  );
}

// Dynamic badge text based on event timing
function getTimeBadge(startTime: string | null, isAllDay: boolean): { text: string; isNow: boolean } {
  if (isAllDay || !startTime) return { text: "TODAY", isNow: false };

  const now = new Date();
  const [hours, minutes] = startTime.split(":").map(Number);
  const eventMinutes = hours * 60 + minutes;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const diffMinutes = eventMinutes - nowMinutes;

  // Within 2 hours before or 1 hour after start = "NOW"
  if (diffMinutes <= 120 && diffMinutes >= -60) {
    return { text: "NOW", isNow: true };
  }
  // Evening events (6pm+) = "TONIGHT"
  if (hours >= 18) {
    return { text: "TONIGHT", isNow: false };
  }
  return { text: "TODAY", isNow: false };
}

export default function TonightsPicks({ portalSlug }: { portalSlug?: string } = {}) {
  const [events, setEvents] = useState<TonightEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
      }).format(new Date()),
    []
  );

  useEffect(() => {
    async function fetchEvents() {
      try {
        const response = await fetch("/api/tonight");
        if (!response.ok) {
          setEvents([]);
          return;
        }
        const data = await response.json();
        setEvents(data.events || []);
      } catch (error) {
        console.error("Failed to fetch tonight events:", error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, []);

  // Curated picks are already ordered — no grouping/collapsing needed
  const carouselEvents = events.slice(0, 10);
  const hasCarousel = carouselEvents.length > 1;
  const safeHeroIndex = heroIndex < carouselEvents.length ? heroIndex : 0;

  useEffect(() => {
    if (!hasCarousel) {
      setHeroIndex(0);
      return;
    }
    if (heroIndex >= carouselEvents.length) {
      setHeroIndex(0);
    }
  }, [hasCarousel, heroIndex, carouselEvents.length]);

  useEffect(() => {
    if (!hasCarousel) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const interval = window.setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % carouselEvents.length);
    }, 6500);

    return () => window.clearInterval(interval);
  }, [hasCarousel, carouselEvents.length]);

  if (loading) {
    return null; // Parent Suspense will show skeleton
  }

  if (events.length === 0) {
    return null;
  }

  const heroEvent = carouselEvents[safeHeroIndex] ?? null;
  const heroCategory = heroEvent?.category || "other";

  return (
    <section className="-mx-4 px-4 relative overflow-hidden">
      {/* Atmospheric background glow */}
      <div
        data-category={heroCategory}
        className="absolute inset-0 opacity-20 pointer-events-none tonight-picks-glow"
      />
      {/* Clear zone behind hero to reduce texture noise */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--void)]/70 via-[var(--void)]/35 to-transparent pointer-events-none" />

      <div className="relative">
        <FeedSectionHeader
          title={`Some picks for ${todayLabel}`}
          subtitle="Piping hot picks straight from the oven"
          priority="tertiary"
          accentColor="var(--neon-amber)"
          seeAllHref={portalSlug ? `/${portalSlug}?view=events&date=today` : `/?view=events&date=today`}
          seeAllLabel="View all"
        />

        {/* Hero card with optimized image loading */}
        {heroEvent ? (
          <div className="relative mb-4">
            <Link
              key={heroEvent.id}
              href={portalSlug ? `/${portalSlug}?event=${heroEvent.id}` : `/events/${heroEvent.id}`}
              scroll={false}
              data-category={heroCategory}
              className="block relative rounded-[1.35rem] overflow-hidden group card-atmospheric card-hero transition-transform duration-300 hover:scale-[1.01] glow-category will-change-transform"
            >
              {/* Background - using native img to support any image host */}
              {heroEvent.image_url ? (
                <HeroImage src={heroEvent.image_url} alt={heroEvent.title} category={heroEvent.category} />
              ) : (
                <CategoryPlaceholder category={heroEvent.category} size="lg" />
              )}

              {/* Content */}
              <div className="relative p-5 pt-36 sm:pt-40">
                <div className="flex items-center gap-2 mb-2">
                  {(() => {
                    const badge = getTimeBadge(heroEvent.start_time, heroEvent.is_all_day);
                    return (
                      <span className={`px-2 py-0.5 rounded-full text-[0.65rem] font-mono font-medium backdrop-blur-sm ${
                        badge.isNow
                          ? "bg-[var(--neon-red)]/30 text-[var(--neon-red)]"
                          : "bg-[var(--neon-magenta)]/30 text-[var(--neon-magenta)]"
                      }`}>
                        {badge.text}
                      </span>
                    );
                  })()}
                  {heroEvent.category && (
                    <span
                      data-category={heroCategory}
                      className="px-2 py-0.5 rounded-full text-[0.65rem] font-mono font-medium tonights-category-badge"
                    >
                      <CategoryIcon type={heroEvent.category} size={10} className="inline mr-1" glow="none" />
                      {heroEvent.category}
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-[var(--neon-magenta)] transition-colors line-clamp-2">
                  {heroEvent.title}
                </h3>

                <div className="flex items-center gap-2 text-sm text-white/80 font-mono">
                  {heroEvent.start_time && (
                    <span className="font-medium">
                      {formatTimeSplit(heroEvent.start_time, heroEvent.is_all_day).time}
                      <span className="opacity-60 ml-0.5 text-xs">
                        {formatTimeSplit(heroEvent.start_time, heroEvent.is_all_day).period}
                      </span>
                    </span>
                  )}
                  {heroEvent.venue && (
                    <>
                      <span className="opacity-40">·</span>
                      <span>{heroEvent.venue.name}</span>
                    </>
                  )}
                  {heroEvent.is_free && (
                    <>
                      <span className="opacity-40">·</span>
                      <span className="text-[var(--neon-green)]">Free</span>
                    </>
                  )}
                  {heroEvent.rsvp_count && heroEvent.rsvp_count >= 2 && (
                    <>
                      <span className="opacity-40">·</span>
                      <span className="text-[var(--neon-cyan)] flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                        </svg>
                        {heroEvent.rsvp_count} going
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Hover arrow */}
              <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>

            {hasCarousel && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
                {carouselEvents.map((event, index) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setHeroIndex(index)}
                    aria-label={`Show ${event.title}`}
                    className={`h-2.5 w-2.5 rounded-full transition-all ${
                      index === safeHeroIndex
                        ? "bg-[var(--neon-magenta)] shadow-[0_0_8px_rgba(255,85,170,0.8)]"
                        : "bg-white/20 hover:bg-white/50"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}

        {carouselEvents.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 sm:gap-3 sm:overflow-visible sm:snap-none mb-4">
            {carouselEvents.map((event, index) => {
              const isSecondaryRow = index >= 4;
              const eventHref = portalSlug ? `/${portalSlug}/events/${event.id}` : `/events/${event.id}`;
              return (
                <Link
                  key={event.id}
                  href={eventHref}
                  className={`relative overflow-hidden rounded-xl border transition-all text-left group card-atmospheric min-w-[9.5rem] snap-start sm:min-w-0 sm:w-auto ${
                    index === safeHeroIndex
                      ? "border-[var(--neon-magenta)]/70 shadow-[0_0_18px_rgba(255,85,170,0.35)]"
                      : "border-[var(--twilight)] hover:border-[var(--neon-magenta)]/40"
                  } ${isSecondaryRow ? "sm:scale-[0.96] sm:opacity-80" : ""}`}
                >
                  <div className="absolute inset-0">
                    {event.image_url ? (
                      <HeroImage
                        src={event.image_url}
                        alt={event.title}
                        category={event.category}
                        size="sm"
                        loading="lazy"
                        overlay="soft"
                      />
                    ) : (
                      <CategoryPlaceholder category={event.category} size="sm" />
                    )}
                  </div>
                  <div className="absolute inset-0 ring-1 ring-white/10 rounded-xl pointer-events-none" />
                  <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none rounded-b-xl" />
                  <div className="relative p-3 pt-20">
                    <div className="flex items-center justify-between text-[0.55rem] text-white/70 font-mono mb-1">
                      <span>
                        {event.start_time ? formatTimeSplit(event.start_time, event.is_all_day).time : "Today"}
                      </span>
                      {event.category && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/60 border border-white/10 text-white/80 text-[0.5rem] max-w-[6.5rem]">
                          <CategoryIcon type={event.category} size={10} glow="none" className="opacity-90" />
                          <span className="truncate">{getCategoryLabel(event.category)}</span>
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs text-white/90 font-semibold line-clamp-2">
                      {event.title}
                    </h4>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
}
