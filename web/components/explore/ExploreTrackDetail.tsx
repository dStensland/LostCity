"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Image from "@/components/SmartImage";
import AnimatedCount from "@/components/AnimatedCount";
import {
  EXPLORE_THEME,
  getTrackAccentColor,
  getTrackCategory,
} from "@/lib/explore-tracks";
import type { ExploreTrackVenue } from "@/lib/explore-tracks";
import ExploreVenueCard from "./ExploreVenueCard";

type TrackActivity = {
  tonightCount: number;
  weekendCount: number;
  freeCount: number;
  venueCount: number;
};

type TrackData = {
  id: string;
  slug: string;
  name: string;
  quote: string;
  quoteSource: string;
  quotePortraitUrl: string | null;
  description: string | null;
  venues: ExploreTrackVenue[];
  activity: TrackActivity;
};

type FilterKey = "all" | "tonight" | "weekend" | "free";

interface ExploreTrackDetailProps {
  slug: string;
  onBack: () => void;
  portalSlug: string;
}

// Neon-styled floating back button matching EventDetailView
const NeonFloatingBackButton = ({ onBack }: { onBack: () => void }) => (
  <button
    onClick={onBack}
    aria-label="Back to tracks"
    className="group absolute top-4 left-4 flex items-center gap-2 px-3.5 py-2 rounded-full font-mono text-xs font-semibold tracking-wide uppercase transition-all duration-300 z-10 hover:scale-105 neon-back-btn"
  >
    <svg
      className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-0.5 neon-back-icon"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
    </svg>
    <span className="transition-all duration-300 group-hover:text-[var(--coral)] neon-back-text">
      Back
    </span>
  </button>
);

export default function ExploreTrackDetail({
  slug,
  onBack,
  portalSlug,
}: ExploreTrackDetailProps) {
  const [track, setTrack] = useState<TrackData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  const accent = getTrackAccentColor(slug);
  const category = getTrackCategory(slug);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Show "back to top" after scrolling past the hero
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const fetchTrack = async () => {
      try {
        const res = await fetch(
          `/api/explore/tracks/${slug}`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const json = await res.json();
          const t = json.track;
          const activity = json.activity ?? {};
          if (t) {
            setTrack({
              id: t.id,
              slug: t.slug,
              name: t.name,
              quote: t.quote,
              quoteSource: t.quote_source,
              quotePortraitUrl: t.quote_portrait_url,
              description: t.description,
              venues: (json.venues || []).map(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (v: any) => ({
                  id: String(v.track_venue_id ?? v.id),
                  venueId: v.venue?.id ?? v.venue_id,
                  name: v.venue?.name ?? v.name ?? "",
                  slug: v.venue?.slug,
                  neighborhood: v.venue?.neighborhood,
                  imageUrl:
                    v.venue?.hero_image_url || v.venue?.image_url,
                  editorialBlurb:
                    v.editorial_blurb || v.venue?.explore_blurb,
                  sourceUrl: v.source_url ?? null,
                  sourceLabel: v.source_label ?? null,
                  upvoteCount: v.upvote_count ?? 0,
                  hasUpvoted: v.has_upvoted ?? false,
                  isFeatured: v.is_featured ?? false,
                  aliveBadge: v.alive_badge ?? null,
                  topTip: v.top_tip ?? null,
                  venueType: v.venue?.venue_type ?? null,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  highlights: (v.highlights || []).map((h: any) => ({
                    id: h.id,
                    highlightType: h.highlight_type,
                    title: h.title,
                    description: h.description,
                  })),
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  upcomingEvents: (v.upcoming_events || []).map((ev: any) => ({
                    id: ev.id,
                    title: ev.title,
                    startDate: ev.start_date,
                    startTime: ev.start_time,
                    endTime: ev.end_time,
                    category: ev.category,
                    isFree: ev.is_free ?? false,
                    priceMin: ev.price_min,
                    priceMax: ev.price_max,
                    isTonight: ev.is_tonight ?? false,
                  })),
                })
              ),
              activity: {
                tonightCount: activity.tonight_count ?? 0,
                weekendCount: activity.weekend_count ?? 0,
                freeCount: activity.free_count ?? 0,
                venueCount: activity.venue_count ?? 0,
              },
            });
          }
        }
      } catch {
        // Silently fail
      } finally {
        setIsLoading(false);
      }
    };
    fetchTrack();
    return () => controller.abort();
  }, [slug]);

  // Filter venues based on active filter
  const filteredVenues = useMemo(() => {
    if (!track) return [];
    if (activeFilter === "all") return track.venues;
    return track.venues.filter((v) => {
      const events = v.upcomingEvents ?? [];
      if (activeFilter === "tonight") return events.some((e) => e.isTonight);
      if (activeFilter === "weekend") return events.length > 0;
      if (activeFilter === "free") return events.some((e) => e.isFree);
      return true;
    });
  }, [track, activeFilter]);

  const handleUpvote = useCallback(
    async (trackVenueId: string) => {
      if (!track) return;
      setTrack((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          venues: prev.venues.map((v) =>
            v.id === trackVenueId
              ? {
                  ...v,
                  hasUpvoted: !v.hasUpvoted,
                  upvoteCount: v.hasUpvoted
                    ? v.upvoteCount - 1
                    : v.upvoteCount + 1,
                }
              : v
          ),
        };
      });

      try {
        const res = await fetch("/api/explore/upvote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityType: "track_venue",
            entityId: trackVenueId,
          }),
        });
        if (!res.ok) rollbackUpvote(trackVenueId);
      } catch {
        rollbackUpvote(trackVenueId);
      }
    },
    [track]
  );

  const rollbackUpvote = (trackVenueId: string) => {
    setTrack((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        venues: prev.venues.map((v) =>
          v.id === trackVenueId
            ? {
                ...v,
                hasUpvoted: !v.hasUpvoted,
                upvoteCount: v.hasUpvoted
                  ? v.upvoteCount - 1
                  : v.upvoteCount + 1,
              }
            : v
        ),
      };
    });
  };

  if (isLoading) return <TrackDetailSkeleton onBack={onBack} />;

  if (!track) {
    return (
      <div
        className="rounded-2xl overflow-hidden relative"
        style={{ background: "var(--void)", minHeight: 320 }}
      >
        <NeonFloatingBackButton onBack={onBack} />
        <div className="flex flex-col items-center justify-center h-full py-24">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Track not found
          </p>
          <button
            onClick={onBack}
            className="mt-4 text-xs font-mono underline"
            style={{ color: EXPLORE_THEME.primary }}
          >
            Back to tracks
          </button>
        </div>
      </div>
    );
  }

  // Three-tier venue split: featured -> with events -> rest
  const featured = filteredVenues.filter((v) => v.isFeatured);
  const happeningNow = filteredVenues.filter((v) => !v.isFeatured && (v.upcomingEvents?.length ?? 0) > 0);
  const morePlaces = filteredVenues.filter((v) => !v.isFeatured && (v.upcomingEvents?.length ?? 0) === 0);

  // Compute total events from venue data
  const totalEvents = track.venues.reduce(
    (sum, v) => sum + (v.upcomingEvents?.length ?? 0),
    0
  );

  return (
    <div
      className="rounded-2xl overflow-hidden animate-page-enter"
      style={{ background: "var(--void)" }}
    >
      {/* ================================================================
          HERO — Cinematic, brighter, taller
          Uses first featured venue image (not quote portrait)
          ================================================================ */}
      <div
        className="track-detail-hero relative overflow-hidden"
        style={{ height: "clamp(320px, 50vh, 480px)" }}
      >
        {(() => {
          const heroVenue = track.venues.find((v) => v.isFeatured && v.imageUrl) || track.venues.find((v) => v.imageUrl);
          const heroImage = heroVenue?.imageUrl;
          return heroImage ? (
            <Image
              src={heroImage}
              alt={track.name}
              fill
              sizes="(max-width: 768px) 100vw, 800px"
              className="object-cover object-center explore-detail-hero-img"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{ "--hero-accent": accent } as React.CSSProperties}
            >
              <div className="absolute inset-0 hero-fallback-ambient" />
              <div className="absolute top-0 left-[10%] right-[10%] h-[2px] hero-fallback-topline" />
              <div className="absolute inset-0 hero-fallback-scanlines opacity-[0.03]" />
            </div>
          );
        })()}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, var(--void) 0%, rgba(9,9,11,0.85) 30%, rgba(9,9,11,0.4) 70%, transparent 100%)",
          }}
        />

        {/* Accent left-edge glow bar */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[4px] z-[3]"
          style={{
            background: accent,
            boxShadow: `0 0 16px ${accent}35, 0 0 6px ${accent}60`,
          }}
        />

        {/* Back button — NeonBackButton pattern */}
        <NeonFloatingBackButton onBack={onBack} />

        {/* Content */}
        <div className="relative z-[2] flex flex-col justify-end h-full p-5 md:p-7 pt-20">
          {/* Category pill */}
          <div
            className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] mb-2.5 inline-block px-2.5 py-1 rounded-md animate-fade-in stagger-1"
            style={{
              background: "rgba(0,0,0,0.6)",
              border: `1px solid ${accent}`,
              color: accent,
              alignSelf: "flex-start",
            }}
          >
            {category}
          </div>

          {/* Title */}
          <h1
            className="explore-display-heading text-[38px] md:text-[52px] leading-[1.08] tracking-[-0.02em] mb-3 animate-fade-in stagger-2"
            style={{
              color: "var(--cream)",
              textShadow: `0 2px 16px rgba(0,0,0,0.8), 0 0 40px ${accent}15`,
            }}
          >
            {track.name}
          </h1>

          {/* Description */}
          {track.description && (
            <p
              className="text-[15px] leading-[1.6] max-w-[85%] animate-fade-in stagger-3"
              style={{ color: "var(--soft)" }}
            >
              {track.description}
            </p>
          )}

          {/* Quote with portrait inset */}
          {track.quote && (
            <div className="mt-3 max-w-[85%] explore-quote-enter flex items-start gap-3">
              {track.quotePortraitUrl && (
                <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden border-2" style={{ borderColor: `${accent}60` }}>
                  <Image
                    src={track.quotePortraitUrl}
                    alt={track.quoteSource}
                    width={48}
                    height={48}
                    className="object-cover w-full h-full"
                  />
                </div>
              )}
              <div>
                <p
                  className="text-[14px] italic leading-[1.55]"
                  style={{ color: "var(--soft)", opacity: 0.8 }}
                >
                  &ldquo;{track.quote}&rdquo;
                </p>
                {track.quoteSource && (
                  <p
                    className="text-[12px] font-mono mt-1"
                    style={{ color: accent }}
                  >
                    &mdash; {track.quoteSource}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================
          ACTIVITY SUMMARY BAR — Richer stats, animated counters
          ================================================================ */}
      <ActivityBar activity={track.activity} venues={track.venues} totalEvents={totalEvents} />

      {/* Filter Chips */}
      <FilterRow
        active={activeFilter}
        onSelect={setActiveFilter}
        accent={accent}
        activity={track.activity}
      />

      {/* ================================================================
          VENUE LIST — 2-col grid for featured, compact grid below
          ================================================================ */}
      <div key={activeFilter} className="px-4 lg:px-6 pb-6 pt-4 animate-fade-in">
        {/* Don't Miss — featured venues */}
        {featured.length > 0 && (
          <>
            <div className="flex items-center gap-2 py-2 mb-3">
              <div
                className="h-[2px] w-8 rounded-full"
                style={{ background: accent }}
              />
              <p
                className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: accent }}
              >
                Don&apos;t miss
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {featured.map((venue, index) => (
                <div
                  key={venue.id}
                  className="explore-track-enter"
                  style={{ animationDelay: `${Math.min(index * 50, 300)}ms` }}
                >
                  <ExploreVenueCard
                    venue={venue}
                    portalSlug={portalSlug}
                    onUpvote={() => handleUpvote(venue.id)}
                    accent={accent}
                    variant="featured"
                    highlight
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {/* Happening This Week — non-featured with events */}
        {happeningNow.length > 0 && (
          <>
            <div className="flex items-center gap-2 py-2 mb-3 mt-4">
              <div
                className="h-[2px] w-8 rounded-full"
                style={{ background: accent }}
              />
              <p
                className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: accent }}
              >
                Happening this week
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {happeningNow.map((venue, index) => (
                <div
                  key={venue.id}
                  className="explore-track-enter"
                  style={{ animationDelay: `${Math.min(index * 50, 300)}ms` }}
                >
                  <ExploreVenueCard
                    venue={venue}
                    portalSlug={portalSlug}
                    onUpvote={() => handleUpvote(venue.id)}
                    accent={accent}
                    variant="featured"
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {/* More Places — compact grid */}
        {morePlaces.length > 0 && (
          <>
            <div className="flex items-center gap-2 py-2 mb-3 mt-4">
              <div
                className="h-[2px] w-6 rounded-full"
                style={{ background: "var(--twilight)" }}
              />
              <p
                className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: "var(--muted)" }}
              >
                {(featured.length + happeningNow.length) > 0 ? `More ${category.toLowerCase()} spots` : "All places"}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {morePlaces.map((venue, index) => (
                <div
                  key={venue.id}
                  className="explore-track-enter"
                  style={{ animationDelay: `${Math.min(index * 50, 400)}ms` }}
                >
                  <ExploreVenueCard
                    venue={venue}
                    portalSlug={portalSlug}
                    onUpvote={() => handleUpvote(venue.id)}
                    accent={accent}
                    variant="compact"
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {filteredVenues.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {activeFilter === "all"
                ? "No venues in this track yet"
                : `No ${activeFilter} events right now`}
            </p>
            {activeFilter !== "all" && (
              <button
                onClick={() => setActiveFilter("all")}
                className="mt-2 text-xs font-mono underline"
                style={{ color: accent }}
              >
                Show all places
              </button>
            )}
          </div>
        )}
      </div>

      {/* Floating scroll-to-top for long tracks */}
      {track.venues.length >= 15 && showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-1.5 px-3.5 py-2.5 rounded-full font-mono text-[10px] font-semibold uppercase tracking-wide transition-all duration-300 hover:scale-105"
          style={{
            background: "rgba(0,0,0,0.85)",
            border: `1px solid ${accent}60`,
            color: accent,
            boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 12px ${accent}15`,
            backdropFilter: "blur(12px)",
          }}
          aria-label="Scroll to top"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
          </svg>
          Top
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Activity Summary Bar — Richer stats with animated counters
// ============================================================================

function ActivityBar({
  activity,
  venues,
  totalEvents,
}: {
  activity: TrackActivity;
  venues: ExploreTrackVenue[];
  totalEvents: number;
}) {
  const stats: { label: string; value: number; colorClass: string }[] = [];

  // Always show Places
  stats.push({ label: "Places", value: activity.venueCount, colorClass: "default" });

  // Always show Events if any
  if (totalEvents > 0) {
    stats.push({ label: "Events", value: totalEvents, colorClass: "default" });
  }

  if (activity.tonightCount > 0) {
    stats.push({ label: "Tonight", value: activity.tonightCount, colorClass: "tonight" });
  }
  if (activity.weekendCount > 0) {
    stats.push({ label: "This weekend", value: activity.weekendCount, colorClass: "weekend" });
  }
  if (activity.freeCount > 0) {
    stats.push({ label: "Free events", value: activity.freeCount, colorClass: "free" });
  }

  const valueColors: Record<string, string> = {
    tonight: "#E03A3E",
    weekend: "#C1D32F",
    free: "#34D399",
    default: "var(--cream)",
  };

  return (
    <div
      className="flex border-b py-4 md:py-5 animate-content-reveal stagger-3"
      style={{
        borderColor: "var(--twilight)",
        background:
          "linear-gradient(to bottom, color-mix(in srgb, var(--night) 60%, transparent) 0%, transparent 100%)",
      }}
    >
      {/* Screen reader summary */}
      <span className="sr-only">
        Track activity: {activity.venueCount} places, {totalEvents} events, {activity.tonightCount} tonight, {activity.weekendCount} this weekend, {activity.freeCount} free
      </span>
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className="flex-1 px-4 text-center"
          style={{
            borderRight:
              i < stats.length - 1
                ? "1px solid var(--twilight)"
                : "none",
          }}
        >
          {stat.colorClass === "tonight" ? (
            <div
              className="flex items-center justify-center gap-1.5 mb-1"
              style={{
                color: valueColors[stat.colorClass],
                textShadow: `0 0 12px ${valueColors[stat.colorClass]}30`,
              }}
            >
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: valueColors.tonight }}
              />
              <AnimatedCount
                value={stat.value}
                className="text-2xl md:text-3xl font-black"
              />
            </div>
          ) : (
            <div
              className="mb-1"
              style={{
                color: valueColors[stat.colorClass],
                textShadow: stat.colorClass !== "default" ? `0 0 12px ${valueColors[stat.colorClass]}30` : "none",
              }}
            >
              <AnimatedCount
                value={stat.value}
                className="text-2xl md:text-3xl font-black"
              />
            </div>
          )}
          <div
            className="font-mono text-[10px] md:text-[11px] uppercase tracking-[0.05em]"
            style={{ color: "var(--muted)" }}
          >
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Filter Chips — scrollable row
// ============================================================================

function FilterRow({
  active,
  onSelect,
  accent,
  activity,
}: {
  active: FilterKey;
  onSelect: (key: FilterKey) => void;
  accent: string;
  activity: TrackActivity;
}) {
  const filters: { key: FilterKey; label: string; show: boolean }[] = [
    { key: "all", label: "All", show: true },
    { key: "tonight", label: "Tonight", show: activity.tonightCount > 0 },
    { key: "weekend", label: "This Weekend", show: activity.weekendCount > 0 },
    { key: "free", label: "Free", show: activity.freeCount > 0 },
  ];

  const visibleFilters = filters.filter((f) => f.show);

  // Don't show filter row if only "All" is available
  if (visibleFilters.length <= 1) return null;

  return (
    <div
      className="flex gap-1.5 px-4 py-2.5 overflow-x-auto border-b scrollbar-hide"
      style={{
        borderColor: "var(--twilight)",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {visibleFilters.map((f) => (
        <button
          key={f.key}
          onClick={() => onSelect(f.key)}
          className="font-mono text-[10px] font-medium px-3 py-[5px] rounded-full whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          aria-current={active === f.key ? "true" : undefined}
          style={
            active === f.key
              ? {
                  background: `${accent}18`,
                  border: `1px solid ${accent}4D`,
                  color: accent,
                }
              : {
                  background: "color-mix(in srgb, var(--night) 80%, transparent)",
                  border: "1px solid var(--twilight)",
                  color: "var(--muted)",
                }
          }
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Skeleton — matches new layout proportions, with back button
// ============================================================================

function TrackDetailSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--void)" }}
    >
      {/* Hero skeleton */}
      <div
        className="skeleton-shimmer relative"
        style={{ height: "clamp(320px, 50vh, 480px)", background: "var(--night)" }}
      >
        <NeonFloatingBackButton onBack={onBack} />
        {/* Text placeholder shapes */}
        <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7 space-y-2.5">
          <div
            className="h-5 w-20 rounded skeleton-shimmer"
            style={{ background: "rgba(255,255,255,0.06)" }}
          />
          <div
            className="h-12 w-3/5 rounded skeleton-shimmer"
            style={{ background: "rgba(255,255,255,0.08)" }}
          />
          <div
            className="h-4 w-4/5 rounded skeleton-shimmer"
            style={{ background: "rgba(255,255,255,0.04)" }}
          />
        </div>
      </div>
      {/* Activity bar skeleton */}
      <div
        className="flex border-b py-4"
        style={{ borderColor: "var(--twilight)" }}
      >
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-1 px-4 text-center space-y-1.5">
            <div
              className="h-7 w-10 mx-auto rounded skeleton-shimmer"
              style={{ background: "var(--night)", animationDelay: `${i * 60}ms` }}
            />
            <div
              className="h-2.5 w-14 mx-auto rounded skeleton-shimmer"
              style={{ background: "var(--night)", animationDelay: `${i * 60 + 30}ms` }}
            />
          </div>
        ))}
      </div>
      {/* Venue grid skeleton */}
      <div className="px-4 pb-6 pt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-xl overflow-hidden skeleton-shimmer"
              style={{
                background: "var(--night)",
                height: 220,
                animationDelay: `${i * 80}ms`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
