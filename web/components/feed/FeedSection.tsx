"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import CategoryIcon, { getCategoryColor, CATEGORY_CONFIG, type CategoryType } from "../CategoryIcon";
import CategoryPlaceholder from "../CategoryPlaceholder";
import { LiveBadge, SoonBadge, FreeBadge } from "../Badge";
import { formatTime } from "@/lib/formats";
import { usePortal } from "@/lib/portal-context";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { FeaturedCarousel } from "./FeaturedCarousel";
import LinkifyText from "../LinkifyText";

// Types
export type FeedEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
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
  going_count?: number;
  is_trending?: boolean;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
    slug: string | null;
  } | null;
};

export type FeedSectionData = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  section_type: "auto" | "curated" | "mixed";
  block_type: string;
  layout: string;
  items_per_row?: number;
  style?: Record<string, unknown> | null;
  block_content?: Record<string, unknown> | null;
  auto_filter?: {
    categories?: string[];
    tags?: string[];
    is_free?: boolean;
    date_filter?: string;
    sort_by?: string;
  } | null;
  events: FeedEvent[];
};

type Props = {
  section: FeedSectionData;
  isFirst?: boolean;
};

// Helper: Get event status (live, soon, or null)
function getEventStatus(date: string, time: string | null): "live" | "soon" | null {
  if (!time) return null;

  const eventDate = parseISO(date);
  if (!isToday(eventDate)) return null;

  const [hours, minutes] = time.split(":").map(Number);
  const eventDateTime = new Date();
  eventDateTime.setHours(hours, minutes, 0, 0);
  const now = Date.now();

  if (eventDateTime > new Date()) {
    const minutesUntil = Math.round((eventDateTime.getTime() - now) / (1000 * 60));
    if (minutesUntil <= 30) {
      return "soon";
    }
  } else {
    // Event started - check if still happening (within last 2 hours)
    const minutesAgo = Math.round((now - eventDateTime.getTime()) / (1000 * 60));
    if (minutesAgo <= 120) {
      return "live";
    }
  }
  return null;
}

// Helper: Get smart time display (always shows actual time)
function getSmartTime(date: string, time: string | null): string {
  if (!time) return "All day";

  const eventDate = parseISO(date);
  const formattedTime = formatTime(time);

  if (isToday(eventDate)) {
    return formattedTime;
  }

  if (isTomorrow(eventDate)) {
    return formattedTime;
  }

  return formattedTime;
}

// Helper: Get smart date display
function getSmartDate(date: string): string {
  const eventDate = parseISO(date);
  if (isToday(eventDate)) return "Today";
  if (isTomorrow(eventDate)) return "Tomorrow";
  return format(eventDate, "EEE, MMM d");
}

// Helper: Build "See all" URL based on section filters
function getSeeAllUrl(section: FeedSectionData, portalSlug: string): string {
  const params = new URLSearchParams();
  const autoFilter = section.auto_filter;

  // Always include view=find when there are filters to show filtered results
  let hasFilters = false;

  if (autoFilter?.categories?.length) {
    params.set("categories", autoFilter.categories.join(","));
    hasFilters = true;
  }
  if (autoFilter?.tags?.length) {
    params.set("tags", autoFilter.tags.join(","));
    hasFilters = true;
  }
  if (autoFilter?.is_free) {
    params.set("price", "free");
    hasFilters = true;
  }
  if (autoFilter?.date_filter === "today") {
    params.set("date", "today");
    hasFilters = true;
  } else if (autoFilter?.date_filter === "this_weekend") {
    params.set("date", "weekend");
    hasFilters = true;
  }

  // Switch to find view when filters are applied
  if (hasFilters) {
    params.set("view", "find");
  }

  const queryString = params.toString();
  return `/${portalSlug}${queryString ? `?${queryString}` : ""}`;
}

export default function FeedSection({ section, isFirst }: Props) {
  const { portal } = usePortal();
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({
    threshold: 0.05,
    rootMargin: "0px 0px -20px 0px",
  });

  // Hide images can be configured per-portal via settings.feed.hide_images
  const hideImages = portal.settings?.feed?.hide_images === true;

  // Render content based on block type
  const renderContent = () => {
    switch (section.block_type) {
      case "featured_carousel":
        return <FeaturedCarousel events={section.events} />;
      case "hero_banner":
        return <HeroBanner section={section} portalSlug={portal.slug} hideImages={hideImages} />;
      case "category_grid":
        return <CategoryGrid section={section} portalSlug={portal.slug} isFirst={isFirst} />;
      case "venue_list":
        return <VenueList section={section} portalSlug={portal.slug} />;
      case "announcement":
        return <Announcement section={section} />;
      case "external_link":
        return <ExternalLink section={section} />;
      case "event_cards":
      case "event_carousel":
        return <EventCards section={section} portalSlug={portal.slug} hideImages={hideImages} />;
      case "event_list":
      default:
        return <EventList section={section} portalSlug={portal.slug} />;
    }
  };

  // First section doesn't need scroll reveal (already visible)
  if (isFirst) {
    return renderContent();
  }

  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ease-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
    >
      {renderContent()}
    </div>
  );
}

// ============================================
// SECTION HEADER - Reusable header with "See all"
// ============================================

// Holiday/themed section icon configurations
const THEMED_SECTION_ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
  "valentines-day": {
    color: "#FF69B4", // Hot pink / neon pink
    icon: (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/icons/valentines-heart.png" alt="" className="w-8 h-8 object-contain" />
    ),
  },
  "lunar-new-year": {
    color: "#DC143C", // Crimson red
    icon: (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/icons/fire-horse.png" alt="" className="w-8 h-8 object-contain" />
    ),
  },
  "super-bowl": {
    color: "var(--neon-green)",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <ellipse cx="12" cy="12" rx="10" ry="6" />
        <path d="M2 12c0 3.31 4.48 6 10 6s10-2.69 10-6M7 12c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2M12 6v12" stroke="var(--void)" strokeWidth="1.5" fill="none" />
      </svg>
    ),
  },
  "black-history-month": {
    color: "#9B59B6", // Purple
    icon: (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/icons/raised-fist.png" alt="" className="w-8 h-8 object-contain" />
    ),
  },
  "mardi-gras": {
    color: "var(--violet)",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L9 9H2l5.5 4.5L5 21l7-5 7 5-2.5-7.5L22 9h-7L12 2z" />
      </svg>
    ),
  },
};

function SectionHeader({
  section,
  portalSlug,
  showCount = true
}: {
  section: FeedSectionData;
  portalSlug: string;
  showCount?: boolean;
}) {
  const eventCount = section.events.length;
  const seeAllUrl = getSeeAllUrl(section, portalSlug);

  // Build description with context
  let contextDescription = section.description;
  if (!contextDescription && showCount && eventCount > 0) {
    contextDescription = `${eventCount} event${eventCount !== 1 ? "s" : ""}`;
  }

  // Check if this is a themed section
  const themedConfig = THEMED_SECTION_ICONS[section.slug];
  const sectionStyle = section.style as { accent_color?: string } | null;
  const accentColor = themedConfig?.color || sectionStyle?.accent_color;

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        {/* Themed icon with glow */}
        {themedConfig && (
          <div
            className="flex items-center justify-center w-10 h-10 rounded-lg overflow-hidden"
            style={{
              color: accentColor,
              backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
              boxShadow: `0 0 16px color-mix(in srgb, ${accentColor} 50%, transparent)`,
            }}
          >
            {themedConfig.icon}
          </div>
        )}
        <div>
          <h3
            className="text-xl font-semibold tracking-tight"
            style={{
              color: accentColor || "var(--cream)",
              textShadow: accentColor ? `0 0 20px color-mix(in srgb, ${accentColor} 50%, transparent)` : undefined,
            }}
          >
            {section.title}
          </h3>
          {contextDescription && (
            <p className="font-mono text-xs text-[var(--muted)] mt-0.5">{contextDescription}</p>
          )}
        </div>
      </div>
      <Link
        href={seeAllUrl}
        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-mono transition-all group hover:scale-105"
        style={{
          color: accentColor || "var(--muted)",
          backgroundColor: accentColor ? `color-mix(in srgb, ${accentColor} 10%, transparent)` : undefined,
          boxShadow: accentColor ? `0 0 12px color-mix(in srgb, ${accentColor} 30%, transparent)` : undefined,
        }}
      >
        See all
        <svg
          className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

// ============================================
// SOCIAL PROOF BADGE - Shows popularity
// ============================================

// Trending/fire icon SVG
const TrendingIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z" />
  </svg>
);

function SocialProofBadge({ count, variant = "default" }: { count: number; variant?: "default" | "compact" }) {
  if (count < 3) return null;

  const isHot = count >= 10;

  if (variant === "compact") {
    return (
      <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.55rem] font-mono font-medium ${
        isHot
          ? "bg-[var(--coral)]/20 text-[var(--coral)]"
          : "bg-[var(--twilight)] text-[var(--muted)]"
      }`}>
        {isHot && <TrendingIcon className="w-2.5 h-2.5" />}
        {count} going
      </span>
    );
  }

  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono ${
      isHot
        ? "bg-[var(--coral)]/20 text-[var(--coral)]"
        : "bg-white/20 text-white"
    }`}>
      {isHot && <TrendingIcon className="w-3 h-3" />}
      {count} going
    </span>
  );
}

// ============================================
// HERO BANNER - Large featured event
// ============================================

function HeroBanner({ section, portalSlug, hideImages }: { section: FeedSectionData; portalSlug: string; hideImages?: boolean }) {
  const event = section.events[0];

  // Don't render hero if no event
  if (!event) {
    return null;
  }

  const hasImage = !hideImages && event.image_url;
  const categoryColor = event.category ? getCategoryColor(event.category) : "var(--coral)";

  return (
    <section className="mb-10">
      <Link
        href={`/${portalSlug}?event=${event.id}`}
        className="block relative rounded-2xl overflow-hidden group hero-featured coral-glow-hover"
        aria-label={`Featured event: ${event.title}`}
      >
        {/* Background - either image or gradient */}
        {hasImage ? (
          <>
            <div
              className="absolute inset-0 bg-gradient-to-br from-[var(--twilight)] to-[var(--void)]"
              style={{
                backgroundImage: `url(${event.image_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
              role="img"
              aria-label={event.title}
            />
            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/30" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--twilight)] to-[var(--void)]" />
        )}

        {/* Content */}
        <div className="relative p-6 pt-36 sm:pt-44">
          {/* Featured + Category badges */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--gold)] text-[var(--void)] text-xs font-mono font-medium">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Featured
            </span>
            {event.category && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium"
                style={{ backgroundColor: categoryColor, color: "var(--void)" }}
              >
                <CategoryIcon type={event.category} size={12} style={{ color: "var(--void)" }} glow="none" />
                {CATEGORY_CONFIG[event.category as CategoryType]?.label || event.category}
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-2 group-hover:text-[var(--coral)] transition-colors leading-tight">
            {event.title}
          </h2>

          {/* Meta with smart time */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-white/90 font-mono">
            <span className="font-medium">{getSmartDate(event.start_date)}</span>
            {event.start_time && (
              <>
                <span className="opacity-40">·</span>
                <span>{getSmartTime(event.start_date, event.start_time)}</span>
              </>
            )}
            {event.venue && (
              <>
                <span className="opacity-40">·</span>
                <span>{event.venue.name}</span>
              </>
            )}
          </div>

          {/* Editorial blurb */}
          {section.description && (
            <p className="mt-3 text-sm text-white/80 italic leading-relaxed max-w-xl">
              {section.description}
            </p>
          )}

          {/* Price/Free + Social Proof badges */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {event.is_free ? (
              <span className="px-2.5 py-1 rounded-full bg-[var(--neon-green)] text-[var(--void)] text-xs font-mono font-medium">
                FREE
              </span>
            ) : event.price_min !== null ? (
              <span className="px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-mono">
                From ${event.price_min}
              </span>
            ) : null}
            {event.going_count !== undefined && event.going_count > 0 && (
              <SocialProofBadge count={event.going_count} />
            )}
          </div>
        </div>
      </Link>
    </section>
  );
}

// ============================================
// EVENT CARDS - Grid or carousel layout
// ============================================

function EventCards({ section, portalSlug, hideImages }: { section: FeedSectionData; portalSlug: string; hideImages?: boolean }) {
  const isCarousel = section.layout === "carousel";
  const itemsPerRow = section.items_per_row || 2;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false); // Start false, update after mount
  const [activeIndex, setActiveIndex] = useState(0);
  const cardWidth = 288; // w-72 = 18rem = 288px
  const gap = 12; // gap-3 = 0.75rem = 12px

  // Update scroll state and active index
  const updateScrollState = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    // Can scroll right if content is wider than container and not at end
    setCanScrollRight(scrollWidth > clientWidth && scrollLeft < scrollWidth - clientWidth - 10);
    // Calculate which card is most visible
    const index = Math.round(scrollLeft / (cardWidth + gap));
    setActiveIndex(Math.min(index, section.events.length - 1));
  }, [section.events.length]);

  useEffect(() => {
    if (isCarousel && scrollRef.current) {
      // Initial state calculation
      updateScrollState();

      // Listen to scroll events
      const el = scrollRef.current;
      el.addEventListener("scroll", updateScrollState, { passive: true });

      // Listen to resize to recalculate when container size changes
      const resizeObserver = new ResizeObserver(updateScrollState);
      resizeObserver.observe(el);

      return () => {
        el.removeEventListener("scroll", updateScrollState);
        resizeObserver.disconnect();
      };
    }
  }, [isCarousel, updateScrollState]);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const scrollAmount = cardWidth + gap; // Scroll exactly one card
    scrollRef.current.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (section.events.length === 0) {
    return null;
  }

  return (
    <section className="mb-10">
      <SectionHeader section={section} portalSlug={portalSlug} />

      {/* Cards container with carousel enhancements */}
      <div className={isCarousel ? "relative -mx-4 group/carousel" : "relative"}>
        {/* Scroll buttons for desktop - appear on hover */}
        {isCarousel && canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover/carousel:opacity-100 transition-opacity"
            aria-label="Scroll left"
          >
            <div className="w-8 h-8 rounded-full bg-[var(--night)]/90 border border-[var(--twilight)] flex items-center justify-center text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
          </button>
        )}
        {isCarousel && canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover/carousel:opacity-100 transition-opacity"
            aria-label="Scroll right"
          >
            <div className="w-8 h-8 rounded-full bg-[var(--night)]/90 border border-[var(--twilight)] flex items-center justify-center text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        )}

        <div
          ref={scrollRef}
          className={
            isCarousel
              ? "flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory px-4 scroll-smooth"
              : "grid gap-3"
          }
          style={
            !isCarousel
              ? {
                  gridTemplateColumns: `repeat(${Math.min(itemsPerRow, 2)}, minmax(0, 1fr))`,
                }
              : undefined
          }
        >
          {section.events.map((event) => (
            <EventCard key={event.id} event={event} isCarousel={isCarousel} hideImages={hideImages} portalSlug={portalSlug} />
          ))}
        </div>

        {/* Mobile scroll indicator dots */}
        {isCarousel && section.events.length > 1 && (
          <div className="flex sm:hidden justify-center gap-1.5 mt-3">
            {section.events.slice(0, Math.min(section.events.length, 8)).map((_, idx) => (
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
                    ? "bg-[var(--coral)] w-4"
                    : "bg-[var(--twilight)] hover:bg-[var(--muted)]"
                }`}
                aria-label={`Go to card ${idx + 1}`}
              />
            ))}
            {section.events.length > 8 && (
              <span className="text-[0.5rem] text-[var(--muted)] ml-1">+{section.events.length - 8}</span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function EventCard({ event, isCarousel, hideImages, portalSlug }: { event: FeedEvent; isCarousel?: boolean; hideImages?: boolean; portalSlug?: string }) {
  const categoryColor = event.category ? getCategoryColor(event.category) : null;
  const isPopular = (event.going_count || 0) >= 10;
  const showImage = !hideImages && event.image_url;
  const [imageLoaded, setImageLoaded] = useState(!showImage);
  const [imageError, setImageError] = useState(false);
  const eventStatus = getEventStatus(event.start_date, event.start_time);

  return (
    <Link
      href={portalSlug ? `/${portalSlug}?event=${event.id}` : `/events/${event.id}`}
      className={`group flex flex-col rounded-xl overflow-hidden border transition-all hover:border-[var(--coral)]/30 coral-glow-hover ${
        isCarousel ? "flex-shrink-0 w-72 snap-start" : ""
      } ${isPopular ? "border-[var(--coral)]/20 coral-glow" : "border-[var(--twilight)]"}`}
      style={{ backgroundColor: "var(--card-bg)" }}
    >
      {/* Image section */}
      {showImage && !imageError ? (
        <div className="h-36 bg-[var(--twilight)] relative overflow-hidden rounded-t-xl">
          {/* Blur placeholder */}
          {!imageLoaded && (
            <div className="absolute inset-0 bg-[var(--twilight)] animate-pulse" />
          )}
          {/* Actual image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.image_url!}
            alt=""
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              setImageError(true);
              setImageLoaded(true);
            }}
            loading="lazy"
          />

          {/* Popular indicator */}
          {isPopular && (
            <div className="absolute top-2 right-2">
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--coral)] text-[var(--void)] text-[0.6rem] font-mono font-medium shadow-lg">
                <TrendingIcon className="w-2.5 h-2.5" /> Popular
              </span>
            </div>
          )}
        </div>
      ) : isCarousel ? (
        /* No-image fallback for carousel cards - category placeholder */
        <div className="h-32 relative overflow-hidden rounded-t-xl">
          <CategoryPlaceholder category={event.category} />
          {/* Popular indicator */}
          {isPopular && (
            <div className="absolute top-2 right-2 z-10">
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--coral)] text-[var(--void)] text-[0.6rem] font-mono font-medium shadow-lg">
                <TrendingIcon className="w-2.5 h-2.5" /> Popular
              </span>
            </div>
          )}
        </div>
      ) : null}

      {/* Content */}
      <div className="flex-1 p-3">
        {/* Category + Smart Date + Popular (when no image) */}
        <div className="flex items-center gap-2 mb-1.5">
          {event.category && (
            <CategoryIcon type={event.category} size={12} style={{ color: categoryColor || undefined }} />
          )}
          <span className="font-mono text-[0.65rem] text-[var(--muted)]">
            {getSmartDate(event.start_date)}
            {event.start_time && ` · ${getSmartTime(event.start_date, event.start_time)}`}
          </span>
          {/* Show popular badge inline when no image and not carousel (carousel has image area) */}
          {isPopular && !isCarousel && (!showImage || imageError) && (
            <span className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[var(--coral)] text-[var(--void)] text-[0.55rem] font-mono font-medium">
              <TrendingIcon className="w-2.5 h-2.5" /> Popular
            </span>
          )}
        </div>

        {/* Title */}
        <h4 className="font-medium text-sm text-[var(--cream)] line-clamp-2 group-hover:text-[var(--coral)] transition-colors leading-snug">
          {event.title}
        </h4>

        {/* Venue */}
        {event.venue && (
          <p className="font-mono text-[0.6rem] text-[var(--muted)] mt-1.5 truncate">
            {event.venue.name}
            {event.venue.neighborhood && ` · ${event.venue.neighborhood}`}
          </p>
        )}

        {/* Price/Free + Status badges */}
        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          {/* Live/Soon status badges */}
          {eventStatus === "live" && <LiveBadge />}
          {eventStatus === "soon" && <SoonBadge />}
          {event.is_free ? (
            <FreeBadge />
          ) : event.price_min !== null ? (
            <span className="text-[0.6rem] font-mono text-[var(--muted)]">
              From ${event.price_min}
            </span>
          ) : null}
          {event.going_count !== undefined && event.going_count >= 3 && !isPopular && (
            <SocialProofBadge count={event.going_count} variant="compact" />
          )}
        </div>
      </div>
    </Link>
  );
}

// ============================================
// EVENT LIST - Compact list layout
// ============================================

function EventList({ section, portalSlug }: { section: FeedSectionData; portalSlug: string }) {
  if (section.events.length === 0) {
    return null;
  }

  // Group events by date for better scannability
  const eventsByDate = section.events.reduce((acc, event) => {
    const dateKey = event.start_date;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, FeedEvent[]>);

  const sortedDates = Object.keys(eventsByDate).sort();
  const showDateHeaders = sortedDates.length > 1;

  return (
    <section className="mb-10">
      <SectionHeader section={section} portalSlug={portalSlug} />

      {/* List grouped by date */}
      <div className="space-y-4">
        {sortedDates.map((date) => (
          <div key={date}>
            {/* Date header - only show if multiple dates */}
            {showDateHeaders && (
              <div
                className="group flex items-center gap-3 mb-2 px-3 py-2 -mx-3 rounded-lg cursor-default transition-all hover:bg-[var(--twilight)]/20 card-atmospheric"
                style={{
                  "--glow-color": "var(--coral)",
                  "--reflection-color": "rgba(255, 107, 122, 0.08)",
                } as React.CSSProperties}
              >
                <span className="font-mono text-xs font-medium text-[var(--coral)] transition-all group-hover:text-glow">
                  {getSmartDate(date)}
                </span>
                <div className="flex-1 h-px bg-[var(--twilight)]/50" />
              </div>
            )}
            {/* Events for this date */}
            <div className="space-y-2">
              {eventsByDate[date].map((event, idx) => (
                <EventListItem
                  key={event.id}
                  event={event}
                  isAlternate={idx % 2 === 1}
                  showDate={!showDateHeaders}
                  portalSlug={portalSlug}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Get reflection color class based on category
function getReflectionClass(category: string | null): string {
  if (!category) return "";
  const reflectionMap: Record<string, string> = {
    music: "reflect-music",
    comedy: "reflect-comedy",
    art: "reflect-art",
    theater: "reflect-theater",
    film: "reflect-film",
    community: "reflect-community",
    food_drink: "reflect-food",
    food: "reflect-food",
    sports: "reflect-sports",
    fitness: "reflect-fitness",
    nightlife: "reflect-nightlife",
    family: "reflect-family",
  };
  return reflectionMap[category] || "";
}

function EventListItem({ event, isAlternate, showDate = true, portalSlug }: { event: FeedEvent; isAlternate?: boolean; showDate?: boolean; portalSlug?: string }) {
  const categoryColor = event.category ? getCategoryColor(event.category) : null;
  const goingCount = event.going_count || 0;
  const isPopular = goingCount >= 10;
  const isTrending = event.is_trending || false;
  const reflectionClass = getReflectionClass(event.category);
  const eventStatus = getEventStatus(event.start_date, event.start_time);

  // Visual hierarchy classes
  const hierarchyClass = isTrending ? "card-trending" : isPopular ? "card-popular" : "";

  return (
    <Link
      href={portalSlug ? `/${portalSlug}?event=${event.id}` : `/events/${event.id}`}
      className={`flex items-center gap-3 px-3 py-3 rounded-lg border transition-all group card-atmospheric ${reflectionClass} ${hierarchyClass} hover:border-[var(--coral)]/30 ${
        isPopular || isTrending
          ? "border-[var(--coral)]/20"
          : isAlternate
            ? "border-transparent"
            : "border-[var(--twilight)]"
      }`}
      style={{
        backgroundColor: isPopular ? "var(--coral-bg, rgba(190, 53, 39, 0.05))" : "var(--card-bg)",
        borderLeftWidth: categoryColor ? "3px" : undefined,
        borderLeftColor: categoryColor || undefined,
        "--glow-color": categoryColor || "var(--neon-magenta)",
        "--reflection-color": categoryColor ? `color-mix(in srgb, ${categoryColor} 15%, transparent)` : undefined,
      } as React.CSSProperties}
    >
      {/* Smart Time */}
      <div className="flex-shrink-0 w-16 font-mono text-sm text-[var(--soft)] text-center">
        <div className="font-medium">{getSmartTime(event.start_date, event.start_time)}</div>
      </div>

      {/* Category icon */}
      {event.category && (
        <CategoryIcon type={event.category} size={16} className="flex-shrink-0 opacity-60" />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="font-medium text-sm text-[var(--cream)] truncate transition-all group-hover:text-glow"
            style={{
              "--glow-color": categoryColor || "var(--coral)",
            } as React.CSSProperties}
          >
            {event.title}
          </span>
          {isPopular && (
            <span className="flex-shrink-0 text-[var(--coral)]">
              <TrendingIcon className="w-3 h-3" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[0.65rem] text-[var(--muted)]">
          {showDate && (
            <>
              <span>{getSmartDate(event.start_date)}</span>
              {event.venue && <span className="opacity-40">·</span>}
            </>
          )}
          {event.venue && (
            <span className="truncate">{event.venue.name}</span>
          )}
          {event.going_count !== undefined && event.going_count >= 5 && (
            <>
              <span className="opacity-40">·</span>
              <span className="text-[var(--coral)]">{event.going_count} going</span>
            </>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {/* Live/Soon status badges */}
        {eventStatus === "live" && <LiveBadge />}
        {eventStatus === "soon" && <SoonBadge />}
        {event.is_free && <FreeBadge />}
        <svg className="w-4 h-4 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

// ============================================
// CATEGORY GRID - Quick links to categories
// ============================================

function CategoryGrid({ section, portalSlug, isFirst }: { section: FeedSectionData; portalSlug: string; isFirst?: boolean }) {
  const content = section.block_content as {
    categories?: Array<{ id: string; label: string; icon: string; count?: number }>;
  } | null;

  const categories = content?.categories || [];

  if (categories.length === 0) {
    return null;
  }

  return (
    <section className={`mb-10 ${isFirst ? "" : "pt-2"}`}>
      {/* Header */}
      {section.title && (
        <h3 className="text-lg font-semibold tracking-tight text-[var(--cream)] mb-4">{section.title}</h3>
      )}

      {/* Grid with larger touch targets */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {categories.map((cat) => {
          const color = CATEGORY_CONFIG[cat.id as CategoryType]?.color || "var(--muted)";
          return (
            <Link
              key={cat.id}
              href={`/${portalSlug}?categories=${cat.id}`}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[var(--twilight)] hover:border-[var(--coral)]/50 transition-all group min-h-[80px] relative"
              style={{ backgroundColor: "var(--card-bg)" }}
            >
              <CategoryIcon
                type={cat.id}
                size={28}
                style={{ color }}
                className="group-hover:scale-110 transition-transform"
              />
              <span className="font-mono text-[0.65rem] text-[var(--muted)] group-hover:text-[var(--cream)] text-center leading-tight">
                {cat.label}
              </span>
              {/* Event count badge - rendered if count is provided */}
              {cat.count !== undefined && cat.count > 0 && (
                <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-[var(--twilight)] text-[var(--muted)] text-[0.5rem] font-mono font-medium">
                  {cat.count > 99 ? "99+" : cat.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ============================================
// VENUE LIST - Expandable list of venues with showtimes
// ============================================

type VenueShowtime = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  category: string | null;
};

// Group events by title to combine showtimes
function groupEventsByTitle(events: VenueShowtime[]): { title: string; category: string | null; events: VenueShowtime[] }[] {
  const groups = new Map<string, { title: string; category: string | null; events: VenueShowtime[] }>();

  for (const event of events) {
    const key = event.title.toLowerCase().trim();
    if (!groups.has(key)) {
      groups.set(key, { title: event.title, category: event.category, events: [] });
    }
    groups.get(key)!.events.push(event);
  }

  // Sort each group's events by time
  for (const group of groups.values()) {
    group.events.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  }

  // Return groups sorted by earliest showtime
  return Array.from(groups.values()).sort((a, b) =>
    (a.events[0]?.start_time || "").localeCompare(b.events[0]?.start_time || "")
  );
}

function VenueList({ section, portalSlug }: { section: FeedSectionData; portalSlug: string }) {
  const content = section.block_content as {
    venues?: Array<{ id: number; name: string; slug: string; description?: string }>;
  } | null;

  const venues = content?.venues || [];
  const [expandedVenues, setExpandedVenues] = useState<Set<number>>(new Set());
  const [venueEvents, setVenueEvents] = useState<Record<number, VenueShowtime[]>>({});
  const [loadingVenues, setLoadingVenues] = useState<Set<number>>(new Set());

  const toggleVenue = async (venueId: number) => {
    const newExpanded = new Set(expandedVenues);

    if (newExpanded.has(venueId)) {
      newExpanded.delete(venueId);
    } else {
      newExpanded.add(venueId);

      // Fetch events if not already loaded
      if (!venueEvents[venueId]) {
        setLoadingVenues(prev => new Set(prev).add(venueId));
        try {
          const res = await fetch(`/api/venues/${venueId}/events?limit=20`);
          if (res.ok) {
            const data = await res.json();
            setVenueEvents(prev => ({ ...prev, [venueId]: data.events || [] }));
          }
        } catch (err) {
          console.error("Failed to fetch venue events:", err);
        } finally {
          setLoadingVenues(prev => {
            const next = new Set(prev);
            next.delete(venueId);
            return next;
          });
        }
      }
    }

    setExpandedVenues(newExpanded);
  };

  if (venues.length === 0) {
    return null;
  }

  const categoryColor = CATEGORY_CONFIG.film?.color || null;

  return (
    <section className="mb-10">
      {/* Header */}
      {section.title && (
        <div className="mb-4">
          <h3 className="text-xl font-semibold tracking-tight text-[var(--cream)]">{section.title}</h3>
          {section.description && (
            <p className="font-mono text-xs text-[var(--muted)] mt-0.5">{section.description}</p>
          )}
        </div>
      )}

      {/* Venue list */}
      <div className="space-y-2">
        {venues.map((venue) => {
          const isExpanded = expandedVenues.has(venue.id);
          const isLoading = loadingVenues.has(venue.id);
          const events = venueEvents[venue.id] || [];
          const groupedEvents = groupEventsByTitle(events);

          return (
            <div
              key={venue.id}
              className="rounded-lg border border-[var(--twilight)] overflow-hidden"
              style={{
                backgroundColor: "var(--card-bg)",
                borderLeftWidth: categoryColor ? "3px" : undefined,
                borderLeftColor: categoryColor || undefined,
              }}
            >
              {/* Venue header - clickable to expand */}
              <button
                type="button"
                onClick={() => toggleVenue(venue.id)}
                className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-[var(--twilight)]/20 transition-colors"
              >
                <CategoryIcon type="film" size={16} className="flex-shrink-0 opacity-70" />
                <div className="flex-1 min-w-0 text-left">
                  <span className="font-medium text-sm text-[var(--cream)] truncate block">{venue.name}</span>
                  {venue.description && (
                    <span className="text-xs text-[var(--muted)]"><LinkifyText text={venue.description} /></span>
                  )}
                </div>
                {events.length > 0 && (
                  <span className="font-mono text-[0.6rem] text-[var(--muted)] bg-[var(--twilight)]/50 px-1.5 py-0.5 rounded">
                    {groupedEvents.length} {groupedEvents.length === 1 ? "film" : "films"}
                  </span>
                )}
                <svg
                  className={`w-4 h-4 text-[var(--muted)] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded showtimes */}
              {isExpanded && (
                <div className="border-t border-[var(--twilight)]/30">
                  {isLoading ? (
                    <div className="px-3 py-3 text-center">
                      <span className="font-mono text-xs text-[var(--muted)]">Loading showtimes...</span>
                    </div>
                  ) : groupedEvents.length === 0 ? (
                    <div className="px-3 py-3 text-center">
                      <span className="font-mono text-xs text-[var(--muted)]">No upcoming showtimes</span>
                    </div>
                  ) : (
                    <>
                      {groupedEvents.map((group, idx) => (
                        <div
                          key={group.title + idx}
                          className={`px-3 py-2 ${idx > 0 ? "border-t border-[var(--twilight)]/20" : ""}`}
                        >
                          {/* Film title row */}
                          <div className="flex items-center gap-2 mb-1">
                            <CategoryIcon type="film" size={12} className="flex-shrink-0 opacity-50" />
                            <span className="text-sm text-[var(--cream)] truncate">{group.title}</span>
                          </div>

                          {/* Showtimes row */}
                          <div className="flex flex-wrap gap-1.5 ml-5">
                            {group.events.map((event) => (
                              <Link
                                key={event.id}
                                href={`/${portalSlug}?event=${event.id}`}
                                className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--twilight)]/40 text-[var(--muted)] hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-colors"
                              >
                                {formatTime(event.start_time)}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ============================================
// ANNOUNCEMENT - Rich text content
// ============================================

function Announcement({ section }: { section: FeedSectionData }) {
  const content = section.block_content as {
    text?: string;
    cta_text?: string;
    cta_url?: string;
    background_color?: string;
    text_color?: string;
    icon?: string;
  } | null;

  if (!content?.text) {
    return null;
  }

  const style = section.style as {
    background_color?: string;
    text_color?: string;
    border_color?: string;
    accent_color?: string;
  } | null;

  const accentColor = style?.accent_color || "var(--coral)";

  return (
    <section className="mb-10">
      <div
        className="p-5 rounded-xl border-l-4 border"
        style={{
          backgroundColor: style?.background_color || content.background_color || "var(--dusk)",
          borderColor: style?.border_color || "var(--twilight)",
          borderLeftColor: accentColor,
        }}
      >
        <div className="flex gap-4">
          {/* Icon */}
          <div
            className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ color: accentColor }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </div>

          {/* Content */}
          <div className="flex-1">
            {section.title && (
              <h3
                className="text-lg font-semibold tracking-tight mb-1"
                style={{ color: style?.text_color || content.text_color || "var(--cream)" }}
              >
                {section.title}
              </h3>
            )}
            <p
              className="font-mono text-sm leading-relaxed"
              style={{ color: style?.text_color || content.text_color || "var(--soft)" }}
            >
              {content.text}
            </p>
            {content.cta_url && content.cta_text && (
              <Link
                href={content.cta_url}
                className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg font-mono text-sm font-medium transition-colors"
                style={{
                  backgroundColor: accentColor,
                  color: "var(--void)",
                }}
              >
                {content.cta_text}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================
// EXTERNAL LINK - Link card
// ============================================

function ExternalLink({ section }: { section: FeedSectionData }) {
  const content = section.block_content as {
    url?: string;
    image_url?: string;
    cta_text?: string;
  } | null;

  if (!content?.url) {
    return null;
  }

  return (
    <section className="mb-10">
      <a
        href={content.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 p-4 rounded-xl border border-[var(--twilight)] hover:border-[var(--coral)]/30 transition-all group"
        style={{ backgroundColor: "var(--card-bg)" }}
        aria-label={`${section.title} (opens in new tab)`}
      >
        {content.image_url && (
          <div
            className="w-16 h-16 rounded-lg bg-[var(--twilight)] flex-shrink-0"
            style={{
              backgroundImage: `url(${content.image_url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors">
              {section.title}
            </h3>
            <span className="px-1.5 py-0.5 rounded text-[0.55rem] font-mono bg-[var(--twilight)] text-[var(--muted)]">
              External
            </span>
          </div>
          {section.description && (
            <p className="font-mono text-xs text-[var(--muted)] mt-0.5 line-clamp-2">
              {section.description}
            </p>
          )}
        </div>
        <svg
          className="w-5 h-5 text-[var(--muted)] group-hover:text-[var(--cream)] group-hover:translate-x-1 transition-all flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </a>
    </section>
  );
}
