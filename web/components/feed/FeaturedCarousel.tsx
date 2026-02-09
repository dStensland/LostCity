"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { formatTime } from "@/lib/formats";
import { usePortal } from "@/lib/portal-context";
import CategoryPlaceholder from "../CategoryPlaceholder";
import LinkifyText from "../LinkifyText";
import { FreeBadge } from "../Badge";
import FeedSectionHeader from "./FeedSectionHeader";
import SeriesCard from "@/components/SeriesCard";
import FestivalCard from "@/components/FestivalCard";
import { groupEventsForDisplay } from "@/lib/event-grouping";
import type { EventWithLocation } from "@/lib/search";

type FeaturedEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  category: string | null;
  subcategory: string | null;
  image_url: string | null;
  description: string | null;
  featured_blurb?: string | null;
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
    id: number;
    name: string;
    neighborhood: string | null;
    slug: string | null;
  } | null;
};

type Props = {
  events: FeaturedEvent[];
};

export function FeaturedCarousel({ events }: Props) {
  const { portal } = usePortal();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Card dimensions for precise scrolling
  const cardWidth = 320; // w-80 = 20rem = 320px
  const gap = 16; // gap-4 = 1rem = 16px

  const displayItems = useMemo(
    () =>
      groupEventsForDisplay(
        events.map((event) => ({
          ...event,
          category_id: event.category,
          subcategory_id: event.subcategory,
        })) as unknown as EventWithLocation[],
        {
          collapseFestivals: true,
          collapseFestivalPrograms: true,
          rollupVenues: false,
          rollupCategories: false,
          sortByTime: false,
        }
      ),
    [events]
  );

  const displayCount = displayItems.length;

  // Update scroll state and active index
  const updateScrollState = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollWidth > clientWidth && scrollLeft < scrollWidth - clientWidth - 10);

    // Calculate which card is most visible
    const index = Math.round(scrollLeft / (cardWidth + gap));
    setActiveIndex(Math.min(index, Math.max(displayCount - 1, 0)));
  }, [displayCount]);

  useEffect(() => {
    if (scrollRef.current) {
      updateScrollState();

      const el = scrollRef.current;
      el.addEventListener("scroll", updateScrollState, { passive: true });

      const resizeObserver = new ResizeObserver(updateScrollState);
      resizeObserver.observe(el);

      return () => {
        el.removeEventListener("scroll", updateScrollState);
        resizeObserver.disconnect();
      };
    }
  }, [updateScrollState]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = cardWidth + gap;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (displayCount === 0) {
    return null;
  }

  const renderDisplayItem = (item: ReturnType<typeof groupEventsForDisplay>[number]) => {
    if (item.type === "event") {
      return <FeaturedCard key={item.event.id} event={item.event as FeaturedEvent} portalSlug={portal.slug} />;
    }
    if (item.type === "series-group") {
      return (
        <SeriesCard
          key={`series-${item.seriesId}`}
          series={item.series}
          venueGroups={item.venueGroups}
          portalSlug={portal.slug}
          skipAnimation
          disableMargin
          className="flex-shrink-0 w-80 snap-start"
        />
      );
    }
    if (item.type === "festival-group") {
      return (
        <FestivalCard
          key={`festival-${item.festivalId}`}
          festival={item.festival}
          summary={item.summary}
          portalSlug={portal.slug}
          skipAnimation
          disableMargin
          className="flex-shrink-0 w-80 snap-start"
        />
      );
    }
    return null;
  };

  return (
    <section className="mb-10">
      {/* Header with navigation controls */}
      <div className="flex items-center justify-between">
        <FeedSectionHeader
          title="Featured Events"
          subtitle="Handpicked by our editors"
          priority="tertiary"
          accentColor="var(--gold)"
        />
        {/* Navigation arrows - only show when scrollable */}
        {(canScrollLeft || canScrollRight) && (
          <div className="hidden sm:flex items-center gap-1 ml-4">
            {canScrollLeft ? (
              <button
                onClick={() => scroll("left")}
                className="w-8 h-8 rounded-full bg-[var(--night)] border border-[var(--twilight)] flex items-center justify-center text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors"
                aria-label="Scroll left"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : (
              <div className="w-8 h-8" />
            )}
            {canScrollRight ? (
              <button
                onClick={() => scroll("right")}
                className="w-8 h-8 rounded-full bg-[var(--night)] border border-[var(--twilight)] flex items-center justify-center text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors"
                aria-label="Scroll right"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <div className="w-8 h-8" />
            )}
          </div>
        )}
      </div>

      {/* Carousel container */}
      <div className="relative -mx-4">

        {/* Scrollable cards */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory px-4 scroll-smooth"
        >
          {displayItems.map((item) => renderDisplayItem(item))}
        </div>

        {/* Mobile indicator dots */}
        {displayCount > 1 && (
          <div className="flex sm:hidden justify-center gap-1.5 mt-3">
            {displayItems.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (scrollRef.current) {
                    scrollRef.current.scrollTo({
                      left: idx * (cardWidth + gap),
                      behavior: "smooth",
                    });
                  }
                }}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  idx === activeIndex
                    ? "bg-[var(--gold)] w-4"
                    : "bg-[var(--twilight)] hover:bg-[var(--muted)]"
                }`}
                aria-label={`Go to featured event ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function FeaturedCard({ event, portalSlug }: { event: FeaturedEvent; portalSlug: string }) {
  const [imageLoaded, setImageLoaded] = useState(!event.image_url);
  const [imageError, setImageError] = useState(false);
  const showImage = event.image_url && !imageError;

  return (
    <Link
      href={`/${portalSlug}?event=${event.id}`}
      scroll={false}
      className="group flex-shrink-0 w-80 snap-start flex flex-col rounded-2xl overflow-hidden border border-[var(--gold)]/20 transition-all hover:border-[var(--gold)]/50 bg-gradient-to-br from-[var(--night)] to-[var(--void)] relative"
    >
      {/* Image section */}
      {showImage ? (
        <div className="h-44 bg-[var(--twilight)] relative overflow-hidden">
          {!imageLoaded && (
            <div className="absolute inset-0 bg-[var(--twilight)] animate-pulse" />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.image_url!}
            alt=""
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 group-hover:scale-105 ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              setImageError(true);
              setImageLoaded(true);
            }}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          {/* Featured badge - bottom left of image */}
          <div className="absolute bottom-3 left-3 z-10">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-mono font-medium border uppercase tracking-wider featured-badge"
            >
              <svg className="w-3 h-3 featured-badge-icon" viewBox="0 0 20 20" fill="currentColor">
                <path d="M11 1L4 11h5l-1 8 8-10h-5l1-8z" />
              </svg>
              Featured
            </span>
          </div>
        </div>
      ) : (
        <div className="h-44 relative overflow-hidden">
          <CategoryPlaceholder category={event.category} />
          {/* Featured badge - bottom left of placeholder */}
          <div className="absolute bottom-3 left-3 z-10">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-mono font-medium border uppercase tracking-wider featured-badge"
            >
              <svg className="w-3 h-3 featured-badge-icon" viewBox="0 0 20 20" fill="currentColor">
                <path d="M11 1L4 11h5l-1 8 8-10h-5l1-8z" />
              </svg>
              Featured
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-4">
        {/* Title */}
        <h3 className="font-semibold text-base text-[var(--cream)] line-clamp-2 group-hover:text-[var(--gold)] transition-colors leading-snug mb-2">
          {event.title}
        </h3>

        {/* Date & Time */}
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-[var(--gold)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="font-mono text-xs text-[var(--soft)]">
            {format(parseISO(event.start_date), "EEE, MMM d")}
            {event.start_time && ` · ${formatTime(event.start_time)}`}
          </span>
        </div>

        {/* Venue */}
        {event.venue && (
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-[var(--muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="font-mono text-xs text-[var(--muted)] truncate">
              {event.venue.name}
            </span>
          </div>
        )}

        {/* Description preview - use featured_blurb if available */}
        {(event.featured_blurb || event.description) && (
          <p className="text-xs text-[var(--soft)] line-clamp-2 leading-relaxed mb-3">
            <LinkifyText text={event.featured_blurb || event.description || ""} />
          </p>
        )}

        {/* Price/Free badge */}
        <div className="flex items-center gap-2">
          {event.is_free ? (
            <FreeBadge />
          ) : event.price_min !== null ? (
            <span className="px-2.5 py-1 rounded-full bg-[var(--twilight)] text-[var(--muted)] text-xs font-mono">
              From ${event.price_min}
            </span>
          ) : null}
        </div>
      </div>

      {/* Category accent bar at bottom */}
      {event.category && (
        <div
          data-category={event.category}
          className="h-1 w-full bg-[var(--category-color)]"
        />
      )}
    </Link>
  );
}

export type { FeaturedEvent };
