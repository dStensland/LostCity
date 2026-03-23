"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { MusicNote, MaskHappy, Ticket } from "@phosphor-icons/react";
import { formatTime } from "@/lib/formats";
import SmartImage from "@/components/SmartImage";

// ── Types ────────────────────────────────────────────────────────────

interface VenueShow {
  id: number;
  title: string;
  start_time: string | null;
  price_min: number | null;
  image_url: string | null;
  is_free: boolean;
}

interface ShowVenueData {
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    image_url: string | null;
  };
  shows: VenueShow[];
}

interface ShowsApiResponse {
  venues: ShowVenueData[];
  today_count?: number;
  this_week_count?: number;
}

export interface VenueGroupedShowsListProps {
  portalSlug: string;
  categories: string; // "music" or "theater,comedy,dance"
}

// ── Constants ────────────────────────────────────────────────────────

const CARD_WIDTH = 256; // w-64
const GAP = 12; // gap-3
const MAX_SHOWS_PER_CARD = 5;

// ── Component ────────────────────────────────────────────────────────

export function VenueGroupedShowsList({
  portalSlug,
  categories,
}: VenueGroupedShowsListProps) {
  const vertical = categories === "music" ? "music" : "stage";
  const [venues, setVenues] = useState<ShowVenueData[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [thisWeekCount, setThisWeekCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Carousel state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    fetch(
      `/api/portals/${portalSlug}/shows?categories=${encodeURIComponent(categories)}`,
      { signal: controller.signal },
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ShowsApiResponse>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setVenues(data.venues ?? []);
        setTodayCount(data.today_count ?? 0);
        setThisWeekCount(data.this_week_count ?? 0);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setFailed(true);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [portalSlug, categories]);

  const totalCards = venues.length;

  const updateScrollState = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft } = scrollRef.current;
    const index = Math.round(scrollLeft / (CARD_WIDTH + GAP));
    setActiveIndex(Math.min(index, Math.max(totalCards - 1, 0)));
  }, [totalCards]);

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
  }, [updateScrollState]);

  // ── Render gates ─────────────────────────────────────────────────

  // While loading, return null — SeeShowsSection's LazySection holds space
  if (loading) return null;

  // If no shows today but shows this week, show a "this week" note instead of empty
  const restOfWeekCount = thisWeekCount - todayCount;

  if (failed) return null;

  if (venues.length === 0 && restOfWeekCount > 0) {
    return (
      <div className="feed-section-enter px-1 py-4">
        <p className="text-sm text-[var(--soft)]">
          No shows tonight ·{" "}
          <Link
            href={`/${portalSlug}?view=happening&content=showtimes&vertical=${vertical}`}
            className="text-[var(--neon-magenta)] hover:underline font-mono text-xs"
          >
            {restOfWeekCount} more this week →
          </Link>
        </p>
      </div>
    );
  }

  if (venues.length === 0) return null;

  return (
    <div className="relative feed-section-enter">
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory scroll-smooth"
      >
        {venues.map((item) => (
          <VenueShowCard
            key={item.venue.id}
            item={item}
            portalSlug={portalSlug}
            vertical={vertical}
          />
        ))}
      </div>

      {/* "N more this week" note */}
      {restOfWeekCount > 0 && (
        <div className="mt-2 px-1">
          <Link
            href={`/${portalSlug}?view=happening&content=showtimes&vertical=${vertical}`}
            className="text-xs font-mono text-[var(--neon-magenta)] hover:underline"
          >
            {todayCount} tonight · {restOfWeekCount} more this week →
          </Link>
        </div>
      )}

      {/* Mobile dot indicators */}
      {totalCards > 1 && (
        <div className="flex sm:hidden justify-center gap-1.5 mt-3">
          {Array.from({ length: totalCards }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                if (scrollRef.current) {
                  scrollRef.current.scrollTo({
                    left: idx * (CARD_WIDTH + GAP),
                    behavior: "smooth",
                  });
                }
              }}
              className={`h-1.5 rounded-full transition-all ${
                idx === activeIndex
                  ? "bg-[var(--neon-magenta)] w-4"
                  : "bg-[var(--twilight)] hover:bg-[var(--muted)] w-1.5"
              }`}
              aria-label={`Go to card ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── VenueShowCard ─────────────────────────────────────────────────

function VenueShowCard({
  item,
  portalSlug,
  vertical,
}: {
  item: ShowVenueData;
  portalSlug: string;
  vertical: "music" | "stage";
}) {
  const { venue, shows } = item;
  const displayShows = shows.slice(0, MAX_SHOWS_PER_CARD);
  const overflow = shows.length - MAX_SHOWS_PER_CARD;

  return (
    <div className="flex-shrink-0 w-64 snap-start rounded-card overflow-hidden bg-[var(--night)] shadow-card-sm hover-lift border-t-2 border border-[var(--twilight)]/40 border-t-[var(--neon-magenta)]/25">
      {/* Venue image header */}
      <div className="relative h-36 bg-[var(--dusk)] overflow-hidden">
        {venue.image_url ? (
          <>
            <SmartImage
              src={venue.image_url}
              alt=""
              fill
              className="object-cover"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--night)] via-[var(--night)]/60 to-transparent pointer-events-none" />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {vertical === "music" ? (
              <MusicNote
                weight="duotone"
                className="w-10 h-10 text-[var(--neon-magenta)]/30"
              />
            ) : (
              <MaskHappy
                weight="duotone"
                className="w-10 h-10 text-[var(--neon-magenta)]/30"
              />
            )}
          </div>
        )}
        {/* Show count pill */}
        <span className="absolute bottom-2 left-2.5 z-10 text-2xs font-mono text-[var(--cream)]/70 bg-[var(--void)]/60 backdrop-blur-sm px-2 py-0.5 rounded">
          {shows.length} {shows.length === 1 ? "show" : "shows"}
        </span>
      </div>

      {/* Venue name + neighborhood */}
      <Link
        href={`/${portalSlug}?spot=${venue.slug}`}
        className="group block px-3 pt-3 pb-2"
      >
        <span className="text-base font-semibold text-[var(--cream)] group-hover:text-[var(--neon-magenta)] transition-colors truncate block">
          {venue.name}
        </span>
        {venue.neighborhood && (
          <span className="text-xs text-[var(--muted)] truncate block mt-0.5">
            {venue.neighborhood}
          </span>
        )}
      </Link>

      {/* Show rows */}
      <div className="pb-2.5">
        {displayShows.map((show) => (
          <ShowRow key={show.id} show={show} />
        ))}
        {overflow > 0 && (
          <Link
            href={`/${portalSlug}?spot=${venue.slug}`}
            className="block px-3 py-1 text-xs text-[var(--neon-magenta)]/70 hover:text-[var(--neon-magenta)] transition-colors"
          >
            + {overflow} more →
          </Link>
        )}
      </div>
    </div>
  );
}

// ── ShowRow ───────────────────────────────────────────────────────

function ShowRow({ show }: { show: VenueShow }) {
  const timeLabel = show.start_time ? formatTime(show.start_time) : null;

  let priceLabel: string | null = null;
  if (show.is_free) {
    priceLabel = "Free";
  } else if (show.price_min != null && show.price_min > 0) {
    priceLabel = `$${show.price_min}`;
  }

  return (
    <div className="group px-3 py-1.5 transition-colors hover:bg-[var(--cream)]/[0.03]">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-[var(--soft)] truncate block group-hover:text-[var(--cream)] transition-colors flex-1 min-w-0">
          {show.title}
        </span>
        {priceLabel && (
          <span
            className={`shrink-0 text-2xs font-mono px-1.5 py-0.5 rounded ${
              show.is_free
                ? "bg-[var(--neon-green)]/10 text-[var(--neon-green)]/80"
                : "bg-[var(--twilight)]/60 text-[var(--muted)]"
            }`}
          >
            {priceLabel}
          </span>
        )}
      </div>
      {timeLabel && (
        <div className="flex items-center gap-1 mt-1">
          <Ticket weight="duotone" className="w-3 h-3 text-[var(--neon-magenta)]/60 shrink-0" />
          <span className="text-2xs font-mono tabular-nums text-[var(--neon-magenta)]/70">
            {timeLabel}
          </span>
        </div>
      )}
    </div>
  );
}
