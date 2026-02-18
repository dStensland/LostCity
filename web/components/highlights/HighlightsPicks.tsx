"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatTimeSplit } from "@/lib/formats";
import CategoryIcon, { getCategoryLabel } from "../CategoryIcon";
import CategoryPlaceholder from "../CategoryPlaceholder";
import FeedSectionHeader from "../feed/FeedSectionHeader";
import HighlightsTabs, { type HighlightsPeriod } from "./HighlightsTabs";

type HighlightEvent = {
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
  rsvp_count?: number;
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
      ? "bg-gradient-to-t from-black/80 via-black/40 to-black/5"
      : "bg-gradient-to-t from-black/92 via-black/50 to-black/10";
  const glassDepthClass =
    overlay === "soft"
      ? "bg-[radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.08),transparent_44%)]"
      : "bg-[radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.10),transparent_42%)]";

  if (error) {
    return <CategoryPlaceholder category={category} size={size} />;
  }

  return (
    <div className="absolute inset-0 overflow-hidden">
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
      <div className={`absolute inset-0 pointer-events-none ${glassDepthClass}`} />
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

  if (diffMinutes <= 120 && diffMinutes >= -60) {
    return { text: "NOW", isNow: true };
  }
  if (hours >= 18) {
    return { text: "TONIGHT", isNow: false };
  }
  return { text: "TODAY", isNow: false };
}

/** Format a date string like "2026-02-14" as "Fri Feb 14" */
function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00"); // noon to avoid timezone shift
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

/** Get section header title + subtitle for each period */
function getSectionHeader(period: HighlightsPeriod): { title: string; subtitle: string } {
  const todayLabel = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(new Date());
  switch (period) {
    case "today":
      return { title: `Picks for ${todayLabel}`, subtitle: "What's happening today" };
    case "week":
      return { title: "This week", subtitle: "The best of the next 7 days" };
    case "month":
      return { title: "This month", subtitle: "Don't miss these this month" };
  }
}

/** Get "see all" href for the period */
function getSeeAllHref(period: HighlightsPeriod, portalSlug?: string): string {
  const base = portalSlug ? `/${portalSlug}` : "";
  switch (period) {
    case "today":
      return `${base}?view=events&date=today`;
    case "week":
      return `${base}?view=events&date=week`;
    case "month":
      return `${base}?view=events&date=month`;
  }
}

// ============================================================================
// HighlightsLayout — Pure visual component (makes future visual redesign easy)
// ============================================================================

interface HighlightsLayoutProps {
  events: HighlightEvent[];
  period: HighlightsPeriod;
  portalSlug?: string;
  heroIndex: number;
  onHeroChange: (index: number) => void;
}

function HighlightsLayout({ events, period, portalSlug, heroIndex, onHeroChange }: HighlightsLayoutProps) {
  const carouselEvents = events.slice(0, period === "today" ? 12 : period === "week" ? 16 : 20);
  const hasCarousel = carouselEvents.length > 1;
  const safeHeroIndex = heroIndex < carouselEvents.length ? heroIndex : 0;

  useEffect(() => {
    if (!hasCarousel) {
      onHeroChange(0);
      return;
    }
    if (heroIndex >= carouselEvents.length) {
      onHeroChange(0);
    }
  }, [hasCarousel, heroIndex, carouselEvents.length, onHeroChange]);

  useEffect(() => {
    if (!hasCarousel) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const interval = window.setInterval(() => {
      onHeroChange((safeHeroIndex + 1) % carouselEvents.length);
    }, 6500);

    return () => window.clearInterval(interval);
  }, [hasCarousel, carouselEvents.length, safeHeroIndex, onHeroChange]);

  const heroEvent = carouselEvents[safeHeroIndex] ?? null;
  const heroCategory = heroEvent?.category || "other";
  const showDateOnCards = period !== "today";

  return (
    <>
      {/* Hero card */}
      {heroEvent ? (
        <div className="relative mb-4">
          <Link
            key={heroEvent.id}
            href={portalSlug ? `/${portalSlug}?event=${heroEvent.id}` : `/events/${heroEvent.id}`}
            scroll={false}
            data-category={heroCategory}
            className="block relative rounded-[1.35rem] overflow-hidden group card-atmospheric card-hero picks-hero-card transition-transform duration-300 hover:scale-[1.01] glow-category will-change-transform"
          >
            {heroEvent.image_url ? (
              <HeroImage src={heroEvent.image_url} alt={heroEvent.title} category={heroEvent.category} />
            ) : (
              <CategoryPlaceholder category={heroEvent.category} size="lg" />
            )}

            {/* Glassy top-light sheen */}
            <div className="absolute inset-x-0 top-0 h-[35%] bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none rounded-t-[1.35rem]" />

            <div className="relative p-5 pt-36 sm:pt-44">
                {/* Category pill + time badge row */}
                <div className="flex items-center gap-2 mb-3 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                  {heroEvent.category && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.6rem] font-mono font-semibold tracking-wider uppercase bg-[color-mix(in_srgb,var(--category-color)_25%,rgba(0,0,0,0.45))] border border-[color-mix(in_srgb,var(--category-color)_45%,transparent)] text-[var(--category-color)] shadow-[0_0_14px_color-mix(in_srgb,var(--category-color)_20%,transparent)] backdrop-blur-[2px]">
                      <CategoryIcon type={heroEvent.category} size={12} glow="none" />
                      {getCategoryLabel(heroEvent.category)}
                    </span>
                  )}
                  {period === "today" ? (
                    (() => {
                      const badge = getTimeBadge(heroEvent.start_time, heroEvent.is_all_day);
                      return (
                        <span className={`px-2.5 py-1 rounded-full text-[0.6rem] font-mono font-semibold tracking-wider uppercase backdrop-blur-[2px] ${
                          badge.isNow
                            ? "bg-[var(--neon-red)]/30 text-[var(--neon-red)] border border-[var(--neon-red)]/45 shadow-[0_0_14px_rgba(255,69,69,0.35)]"
                            : "bg-white/10 text-white/90 border border-white/20"
                        }`}>
                          {badge.text}
                        </span>
                      );
                    })()
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[0.6rem] font-mono font-semibold tracking-wider uppercase backdrop-blur-[2px] bg-white/10 text-white/90 border border-white/20">
                      {formatShortDate(heroEvent.start_date)}
                    </span>
                  )}
                </div>

                {/* Title — larger, tighter tracking, category-color on hover */}
                <h3 className="text-[1.5rem] sm:text-[1.85rem] font-bold text-white mb-2.5 tracking-[-0.02em] leading-[1.15] group-hover:text-[var(--category-color)] transition-colors duration-300 line-clamp-2 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
                  {heroEvent.title}
                </h3>

                {/* Metadata row — cleaner mono treatment */}
                <div className="flex items-center gap-2.5 text-[0.78rem] text-white/85 font-mono tracking-[0.01em] drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] group-hover:text-[color-mix(in_srgb,var(--category-color)_70%,white)] transition-colors duration-300">
                  {heroEvent.start_time && (
                    <span className="font-semibold tabular-nums">
                      {formatTimeSplit(heroEvent.start_time, heroEvent.is_all_day).time}
                      <span className="opacity-65 ml-0.5 text-[0.65rem] font-medium">
                        {formatTimeSplit(heroEvent.start_time, heroEvent.is_all_day).period}
                      </span>
                    </span>
                  )}
                  {heroEvent.venue && (
                    <>
                      <span className="opacity-40">·</span>
                      <span className="font-medium">{heroEvent.venue.name}</span>
                    </>
                  )}
                  {heroEvent.is_free && (
                    <>
                      <span className="opacity-40">·</span>
                      <span className="text-[var(--neon-green)] font-semibold">Free</span>
                    </>
                  )}
                  {heroEvent.rsvp_count && heroEvent.rsvp_count >= 2 && (
                    <>
                      <span className="opacity-40">·</span>
                      <span className="text-[var(--neon-cyan)] flex items-center gap-1 font-medium">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                        </svg>
                        {heroEvent.rsvp_count} going
                      </span>
                    </>
                  )}
                </div>
            </div>

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
                  onClick={() => onHeroChange(index)}
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

      {/* Thumbnail grid */}
      {carouselEvents.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory sm:mx-0 sm:px-0 sm:grid sm:grid-cols-4 sm:gap-3 sm:overflow-visible sm:snap-none mb-4">
          {carouselEvents.map((event, index) => {
            const isSecondaryRow = index >= 4;
            const eventHref = portalSlug ? `/${portalSlug}/events/${event.id}` : `/events/${event.id}`;
            return (
              <Link
                key={event.id}
                href={eventHref}
                data-category={event.category || "other"}
                className={`relative overflow-hidden rounded-xl border transition-all duration-300 text-left group picks-preview-card min-w-[9.5rem] snap-start sm:min-w-0 sm:w-auto hover:shadow-[0_0_24px_color-mix(in_srgb,var(--category-color)_35%,transparent)] hover:border-[color-mix(in_srgb,var(--category-color)_60%,transparent)] ${
                  index === safeHeroIndex
                    ? "border-[color-mix(in_srgb,var(--category-color)_55%,transparent)] shadow-[0_0_20px_color-mix(in_srgb,var(--category-color)_30%,transparent)]"
                    : "border-white/12"
                } ${isSecondaryRow ? "sm:scale-[0.97] sm:opacity-85 sm:hover:opacity-100 sm:hover:scale-100" : ""}`}
              >
                {/* Image */}
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

                {/* Glassy skeuomorphic light — top highlight sheen */}
                <div className="absolute inset-x-0 top-0 h-[45%] bg-gradient-to-b from-white/[0.09] via-white/[0.03] to-transparent pointer-events-none rounded-t-xl" />
                <div className="absolute top-0 right-0 w-[60%] h-[40%] bg-[radial-gradient(ellipse_at_85%_15%,rgba(255,255,255,0.12),transparent_65%)] pointer-events-none" />

                {/* Bottom scrim for text */}
                <div className="absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-black/88 via-black/50 to-transparent pointer-events-none rounded-b-xl" />

                {/* Inner border highlight for glass depth */}
                <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/[0.08] pointer-events-none" />

                {/* Content */}
                <div className="relative p-3 pt-[4.5rem] flex flex-col justify-end">
                  {/* Category pill — uses category color */}
                  {event.category && (
                    <div className="mb-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.55rem] font-mono font-semibold tracking-wide uppercase bg-[color-mix(in_srgb,var(--category-color)_22%,rgba(0,0,0,0.5))] border border-[color-mix(in_srgb,var(--category-color)_40%,transparent)] text-[var(--category-color)] shadow-[0_0_10px_color-mix(in_srgb,var(--category-color)_15%,transparent)] backdrop-blur-[2px]">
                        <CategoryIcon type={event.category} size={10} glow="none" />
                        <span className="truncate max-w-[5.5rem]">{getCategoryLabel(event.category)}</span>
                      </span>
                    </div>
                  )}

                  {/* Title — bolder, hover transitions to category color */}
                  <h4 className="text-[0.88rem] sm:text-[0.92rem] text-white font-semibold leading-[1.3] line-clamp-2 tracking-[-0.01em] group-hover:text-[var(--category-color)] transition-colors duration-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
                    {event.title}
                  </h4>

                  {/* Time/date — mono, hover transitions to category color */}
                  <span className="mt-1.5 font-mono text-[0.6rem] font-medium tracking-[0.04em] text-white/70 group-hover:text-[color-mix(in_srgb,var(--category-color)_80%,white)] transition-colors duration-300 drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">
                    {showDateOnCards
                      ? formatShortDate(event.start_date)
                      : event.start_time
                        ? (<>{formatTimeSplit(event.start_time, event.is_all_day).time}<span className="opacity-65 ml-0.5">{formatTimeSplit(event.start_time, event.is_all_day).period}</span></>)
                        : "Today"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

// ============================================================================
// HighlightsPicks — Data-fetching wrapper with tabs
// ============================================================================

export default function HighlightsPicks({ portalSlug }: { portalSlug?: string } = {}) {
  const [period, setPeriod] = useState<HighlightsPeriod>("today");
  const [events, setEvents] = useState<HighlightEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);

  const handleHeroChange = useCallback((index: number) => {
    setHeroIndex(index);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchEvents() {
      setLoading(true);
      try {
        const response = await fetch(`/api/tonight?period=${period}`);
        if (!response.ok) {
          if (!cancelled) setEvents([]);
          return;
        }
        const data = await response.json();
        if (!cancelled) {
          setEvents(data.events || []);
          setHeroIndex(0); // Reset hero on period change
        }
      } catch (error) {
        console.error("Failed to fetch highlights:", error);
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchEvents();

    return () => { cancelled = true; };
  }, [period]);

  const { title, subtitle } = getSectionHeader(period);
  const heroCategory = events[0]?.category || "other";

  return (
    <section className="-mx-4 px-4 relative overflow-hidden rounded-[1.35rem] picks-atmosphere-shell">
      {/* Atmospheric background glow */}
      <div
        data-category={heroCategory}
        className="absolute inset-0 opacity-20 pointer-events-none tonight-picks-glow"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--void)]/70 via-[var(--void)]/35 to-transparent pointer-events-none" />

      <div className="relative">
        <HighlightsTabs activePeriod={period} onChange={setPeriod} />

        <FeedSectionHeader
          title={title}
          subtitle={subtitle}
          priority="tertiary"
          accentColor="var(--neon-amber)"
          seeAllHref={getSeeAllHref(period, portalSlug)}
          seeAllLabel="View all"
        />

        {loading ? (
          <div className="space-y-3 pb-2">
            <div className="rounded-[1.35rem] h-[320px] sm:h-[360px] skeleton-shimmer border border-[var(--twilight)]/35" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl h-32 skeleton-shimmer border border-[var(--twilight)]/30" style={{ animationDelay: `${i * 50}ms` }} />
              ))}
            </div>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-[var(--muted)] text-sm font-mono">
            No highlights for this period yet
          </div>
        ) : (
          <HighlightsLayout
            events={events}
            period={period}
            portalSlug={portalSlug}
            heroIndex={heroIndex}
            onHeroChange={handleHeroChange}
          />
        )}
      </div>
    </section>
  );
}
