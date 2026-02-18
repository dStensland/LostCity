"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  Fragment,
  useMemo,
} from "react";
import Link from "next/link";
import Image from "@/components/SmartImage";
import { formatTime } from "@/lib/formats";
import CategoryIcon, { getCategoryColor } from "../CategoryIcon";
import {
  MicrophoneStage,
  Question,
  Target,
  Spade,
  GridFour,
  Headphones,
  Crown,
  Guitar,
  CowboyHat,
  Confetti,
  BeerStein,
  Tag,
  Waveform,
  Smiley,
  DiscoBall,
  MoonStars,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import { usePortal } from "@/lib/portal-context";
import { useScrollReveal } from "@/lib/hooks/useScrollReveal";
import { FeaturedCarousel } from "./FeaturedCarousel";
import LinkifyText from "../LinkifyText";
import FeedSectionHeader, { type SectionPriority } from "./FeedSectionHeader";
import { Cake } from "@phosphor-icons/react";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import EventGroup from "@/components/EventGroup";
import SeriesCard from "@/components/SeriesCard";
import FestivalCard from "@/components/FestivalCard";
import { groupEventsForDisplay, type DisplayItem } from "@/lib/event-grouping";
import type { EventWithLocation } from "@/lib/search";
import { getSmartDateLabel } from "@/lib/card-utils";
import {
  GridEventCard,
  CompactEventCard,
  HeroEventCard,
  type FeedEventData,
} from "@/components/EventCard";
import { trackPortalAction } from "@/lib/analytics/portal-action-tracker";

/** Block javascript: and data: URLs from DB content to prevent XSS */
function isSafeUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("/")
  );
}

// Types
export type FeedEvent = {
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
  going_count?: number;
  interested_count?: number;
  recommendation_count?: number;
  is_trending?: boolean;
  activity_type?: string;
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

const COMMUNITY_SECTION_HINT =
  /\b(get[-\s]?involved|volunteer|activism|civic|community\s+support|community\s+action)\b/i;

function isCommunityActionSection(section: FeedSectionData): boolean {
  const categories = section.auto_filter?.categories || [];
  const tags = section.auto_filter?.tags || [];
  const titleSlug = `${section.slug} ${section.title}`;

  if (
    categories.some(
      (category) => category === "community" || category === "activism",
    )
  ) {
    return true;
  }

  if (
    tags.some((tag) => /\b(volunteer|activism|community|civic)\b/i.test(tag))
  ) {
    return true;
  }

  return COMMUNITY_SECTION_HINT.test(titleSlug);
}

function getCommunityIconType(
  section: FeedSectionData,
): "community" | "activism" {
  const categories = section.auto_filter?.categories || [];
  const tags = section.auto_filter?.tags || [];
  const titleSlug = `${section.slug} ${section.title}`.toLowerCase();
  const activismSignal =
    categories.includes("activism") ||
    tags.some((tag) => /\bactivism|civic|protest\b/i.test(tag)) ||
    /activ|civic|organize/.test(titleSlug);
  return activismSignal ? "activism" : "community";
}

function inferTrackedTargetFromHref(href: string): {
  kind: string;
  id: string | null;
} {
  const eventQueryMatch = href.match(/[?&]event=(\d+)/);
  if (eventQueryMatch?.[1]) return { kind: "event", id: eventQueryMatch[1] };

  const eventPathMatch = href.match(/\/events\/(\d+)/);
  if (eventPathMatch?.[1]) return { kind: "event", id: eventPathMatch[1] };

  const spotQueryMatch = href.match(/[?&]spot=(\d+)/);
  if (spotQueryMatch?.[1]) return { kind: "spot", id: spotQueryMatch[1] };

  const spotPathMatch = href.match(/\/spots\/([^/?#]+)/);
  if (spotPathMatch?.[1]) return { kind: "spot", id: spotPathMatch[1] };

  const seriesPathMatch = href.match(/\/series\/([^/?#]+)/);
  if (seriesPathMatch?.[1]) return { kind: "series", id: seriesPathMatch[1] };

  const festivalPathMatch = href.match(/\/festivals\/([^/?#]+)/);
  if (festivalPathMatch?.[1])
    return { kind: "festival", id: festivalPathMatch[1] };

  if (
    href.includes("view=find") ||
    href.includes("categories=") ||
    href.includes("tags=")
  ) {
    return { kind: "filtered_discovery", id: null };
  }

  return { kind: "link", id: null };
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
  // nightlife_mode sections link to the nightlife category in find view
  if ((autoFilter as Record<string, unknown>)?.nightlife_mode) {
    params.set("categories", "nightlife");
    hasFilters = true;
  }
  if (autoFilter?.tags?.length) {
    params.set("tags", autoFilter.tags.join(","));
    hasFilters = true;
  }
  if (autoFilter?.is_free) {
    params.set("price", "free");
    params.set("free", "1");
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
  const sectionKey = (section.slug || section.id).slice(0, 40);

  const handleSectionClickCapture = useCallback(
    (event: { target: EventTarget | null }) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const href = anchor.getAttribute("href") || anchor.href;
      if (!href) return;

      const inferred = inferTrackedTargetFromHref(href);
      const label = (
        anchor.getAttribute("aria-label") ||
        anchor.textContent ||
        section.title ||
        "Link"
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 160);

      trackPortalAction(portal.slug, {
        action_type: "resource_clicked",
        page_type: "feed",
        section_key: sectionKey,
        target_kind: inferred.kind,
        target_id: inferred.id || undefined,
        target_label: label || undefined,
        target_url: href.slice(0, 700),
        metadata: {
          section_title: section.title,
          block_type: section.block_type,
          layout: section.layout,
        },
      });
    },
    [
      portal.slug,
      section.block_type,
      section.layout,
      section.title,
      sectionKey,
    ],
  );

  // Render content based on block type
  const renderContent = () => {
    switch (section.block_type) {
      case "featured_carousel":
        return <FeaturedCarousel events={section.events} />;
      case "hero_banner":
        return (
          <HeroBanner
            section={section}
            portalSlug={portal.slug}
            hideImages={hideImages}
          />
        );
      case "category_grid":
        return (
          <CategoryGrid
            section={section}
            portalSlug={portal.slug}
            isFirst={isFirst}
          />
        );
      case "venue_list":
        return <VenueList section={section} portalSlug={portal.slug} />;
      case "announcement":
        return <Announcement section={section} />;
      case "external_link":
        return <ExternalLink section={section} />;
      case "nightlife_carousel":
        return (
          <NightlifeCarousel
            section={section}
            portalSlug={portal.slug}
            isFirst={isFirst}
          />
        );
      case "event_cards":
      case "event_carousel":
        return <EventCards section={section} portalSlug={portal.slug} />;
      case "collapsible_events":
        return <CollapsibleEvents section={section} portalSlug={portal.slug} />;
      case "event_list":
      default:
        return <EventList section={section} portalSlug={portal.slug} />;
    }
  };

  // First section doesn't need scroll reveal (already visible)
  if (isFirst) {
    return (
      <div onClickCapture={handleSectionClickCapture}>{renderContent()}</div>
    );
  }

  return (
    <div
      ref={ref}
      onClickCapture={handleSectionClickCapture}
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
const THEMED_SECTION_ICONS: Record<
  string,
  { icon: React.ReactNode; color: string; iconBg?: string }
> = {
  "valentines-day": {
    color: "#FF69B4", // Hot pink / neon pink
    icon: (
      <Image
        src="/icons/valentines-heart.png"
        alt=""
        width={32}
        height={32}
        className="w-full h-full object-cover"
      />
    ),
  },
  "friday-the-13th": {
    color: "#00ff41",
    icon: <span className="text-3xl leading-none select-none">🔪</span>,
  },
  "lunar-new-year": {
    color: "#DC143C", // Crimson red
    icon: (
      <Image
        src="/icons/fire-horse.png"
        alt=""
        width={32}
        height={32}
        className="w-full h-full object-cover"
      />
    ),
  },
  "super-bowl": {
    color: "var(--neon-green)",
    iconBg: "color-mix(in srgb, var(--neon-green) 20%, transparent)",
    icon: (
      <Image
        src="/icons/super-bowl-football.png"
        alt=""
        width={32}
        height={32}
        className="w-full h-full object-cover"
      />
    ),
  },
  "black-history-month": {
    color: "#e53935", // Pan-African red
    icon: (
      <Image
        src="/icons/black-history-fist.png"
        alt=""
        width={32}
        height={32}
        className="w-full h-full object-cover"
      />
    ),
  },
  "mardi-gras": {
    color: "#ffd700", // Mardi Gras gold
    icon: (
      <Image
        src="/images/mardi-gras-mask.svg"
        alt=""
        width={32}
        height={32}
        className="w-full h-full object-contain"
      />
    ),
  },
};

// Holiday card styling - gradient backgrounds and glow effects
const HOLIDAY_CARD_STYLES: Record<
  string,
  { gradient: string; glowColor: string; subtitle: string }
> = {
  "valentines-day": {
    gradient:
      "linear-gradient(135deg, #1a0a1e 0%, #2d0a2e 30%, #1e0a28 60%, #0f0a1a 100%)",
    glowColor: "#ff4da6",
    subtitle: "The heart has reasons that reason cannot know",
  },
  "friday-the-13th": {
    gradient:
      "linear-gradient(135deg, #050a05 0%, #0a1a0a 30%, #051005 60%, #030a03 100%)",
    glowColor: "#00ff41",
    subtitle: "Embrace the unlucky",
  },
  "mardi-gras": {
    gradient:
      "linear-gradient(135deg, #0d0520 0%, #1a0a35 25%, #0a1a08 50%, #1a1505 75%, #0d0520 100%)",
    glowColor: "#d040ff",
    subtitle: "Laissez les bons temps rouler",
  },
  "lunar-new-year": {
    gradient:
      "linear-gradient(135deg, #1a0505 0%, #350a0a 30%, #2a0808 60%, #1a0303 100%)",
    glowColor: "#cc0000",
    subtitle: "A Year of Fire Horsin' Around",
  },
  "black-history-month": {
    gradient:
      "linear-gradient(135deg, #1a0505 0%, #0c0c0c 35%, #0c0c0c 65%, #051a05 100%)",
    glowColor: "#43a047",
    subtitle: "Honoring Black culture, art & community",
  },
};

// Export themed slugs for holiday grouping
export const THEMED_SLUGS = Object.keys(THEMED_SECTION_ICONS);

// Holiday grid - renders holiday sections as horizontal cards with rich styling
export function HolidayGrid({
  sections,
  portalSlug,
}: {
  sections: FeedSectionData[];
  portalSlug: string;
}) {
  if (sections.length === 0) return null;

  return (
    <section className="mb-4 sm:mb-6">
      <FeedSectionHeader
        title="Holidays and Special Times"
        subtitle="Good excuses to go out and get together"
        priority="tertiary"
        accentColor="var(--neon-amber)"
        icon={
          <Cake
            weight="fill"
            className="w-5 h-5 text-[var(--section-accent)]"
          />
        }
      />

      <div className="space-y-2">
        {sections.map((section) => {
          const themed = THEMED_SECTION_ICONS[section.slug];
          const cardStyle = HOLIDAY_CARD_STYLES[section.slug];
          const accentColor = themed?.color || "var(--coral)";
          const glowColor = cardStyle?.glowColor || accentColor;
          const tag = section.auto_filter?.tags?.[0];
          const filterUrl = tag
            ? `/${portalSlug}?tags=${tag}&view=find`
            : getSeeAllUrl(section, portalSlug);
          const eventCount = section.events.length;

          return (
            <Link
              key={section.id}
              href={filterUrl}
              className="block relative rounded-2xl overflow-hidden group"
              style={{ background: cardStyle?.gradient || "var(--card-bg)" }}
            >
              {/* Glow accents */}
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse at 20% 50%, ${glowColor}40 0%, transparent 60%),
                               radial-gradient(ellipse at 80% 80%, ${glowColor}20 0%, transparent 50%)`,
                }}
              />

              <div className="relative flex items-center gap-4 px-5 py-4">
                {/* Icon with glow */}
                <div
                  className="w-14 h-14 flex-shrink-0 rounded-xl flex items-center justify-center overflow-hidden"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${glowColor} 12%, transparent)`,
                    boxShadow: `0 0 20px ${glowColor}15`,
                  }}
                >
                  <div className="w-14 h-14 flex items-center justify-center">
                    {themed?.icon}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-base text-[var(--cream)] group-hover:text-white transition-colors truncate">
                    {section.title}
                  </h4>
                  {cardStyle?.subtitle && (
                    <p className="text-xs text-[var(--soft)] mt-0.5 italic truncate">
                      {cardStyle.subtitle}
                    </p>
                  )}
                </div>

                {/* Event count + arrow */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className="font-mono text-sm font-medium px-2 py-0.5 rounded-full"
                    style={{
                      color: accentColor,
                      backgroundColor: `color-mix(in srgb, ${glowColor} 15%, transparent)`,
                    }}
                  >
                    {eventCount}
                  </span>
                  <svg
                    className="w-5 h-5 text-[var(--muted)] group-hover:text-[var(--cream)] transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// Determine priority based on section type/slug
function getSectionPriority(section: FeedSectionData): SectionPriority {
  // Featured sections get primary treatment
  if (
    section.block_type === "featured_carousel" ||
    section.block_type === "hero_banner"
  ) {
    return "primary";
  }

  if (isCommunityActionSection(section)) {
    return "secondary";
  }

  // Everything else keeps the subtle, magazine-like header
  return "tertiary";
}

function SectionHeader({
  section,
  portalSlug,
  showCount = true,
  priorityOverride,
}: {
  section: FeedSectionData;
  portalSlug: string;
  showCount?: boolean;
  priorityOverride?: SectionPriority;
}) {
  const eventCount = section.events.length;
  const seeAllUrl = getSeeAllUrl(section, portalSlug);
  const displayTitle = /get active/i.test(section.title)
    ? "Get Involved"
    : section.title;

  // Build description with context
  let contextDescription = section.description;
  if (!contextDescription && showCount && eventCount > 0) {
    contextDescription = `${eventCount} event${eventCount !== 1 ? "s" : ""}`;
  }

  // Check if this is a themed section
  const themedConfig = THEMED_SECTION_ICONS[section.slug];
  const sectionStyle = section.style as { accent_color?: string } | null;
  const isCommunitySection = isCommunityActionSection(section);
  const isGetInvolvedSection = /get involved|get active/i.test(section.title);
  if (isCommunitySection && isGetInvolvedSection) {
    contextDescription = "Get Involved";
  }
  const communityIconType = getCommunityIconType(section);
  const communityAccentColor = getCategoryColor(communityIconType);
  const accentColor =
    themedConfig?.color ||
    sectionStyle?.accent_color ||
    (isCommunitySection ? communityAccentColor : undefined);

  // Determine priority
  const priority = priorityOverride || getSectionPriority(section);
  const communityIcon = isCommunitySection ? (
    <CategoryIcon
      type={communityIconType}
      size={18}
      glow="none"
      className="text-[var(--section-accent)]"
    />
  ) : undefined;

  return (
    <FeedSectionHeader
      title={displayTitle}
      subtitle={contextDescription || undefined}
      priority={priority}
      accentColor={accentColor}
      icon={themedConfig?.icon || communityIcon}
      badge={isCommunitySection ? "Get Involved" : undefined}
      seeAllHref={seeAllUrl}
      seeAllLabel={isGetInvolvedSection ? "Get Involved" : undefined}
    />
  );
}

// ============================================
// HERO BANNER - Large featured event
// ============================================

function HeroBanner({
  section,
  portalSlug,
  hideImages,
}: {
  section: FeedSectionData;
  portalSlug: string;
  hideImages?: boolean;
}) {
  const event = section.events[0];
  if (!event) return null;
  return (
    <section className="mb-4 sm:mb-6">
      <HeroEventCard
        event={event as FeedEventData}
        portalSlug={portalSlug}
        hideImages={hideImages}
        editorialBlurb={section.description}
      />
    </section>
  );
}

// ============================================
// EVENT CARDS - Grid or carousel layout
// ============================================

function EventCards({
  section,
  portalSlug,
}: {
  section: FeedSectionData;
  portalSlug: string;
}) {
  const isCarousel = section.layout === "carousel";
  const itemsPerRow = section.items_per_row || 2;
  const isCommunitySection = isCommunityActionSection(section);
  const communityIconType = getCommunityIconType(section);
  const communityAccent = getCategoryColor(communityIconType);
  const communityAccentClass = createCssVarClass(
    "--community-accent",
    communityAccent,
    "community-accent",
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false); // Start false, update after mount
  const [activeIndex, setActiveIndex] = useState(0);
  const cardWidth = 288; // w-72 = 18rem = 288px
  const gap = 12; // gap-3 = 0.75rem = 12px
  const isTwoColumn = Math.min(itemsPerRow, 2) === 2;
  const useCompactCommunityRows = isCommunitySection && !isCarousel;

  const mappedEvents = useMemo(
    () =>
      section.events.map((event) => ({
        ...event,
        category_id: event.category,
      })) as unknown as EventWithLocation[],
    [section.events],
  );

  const displayItems = useMemo(
    () => {
      if (useCompactCommunityRows) {
        return mappedEvents
          .slice()
          .sort((a, b) => {
            const dateCmp = a.start_date.localeCompare(b.start_date);
            if (dateCmp !== 0) return dateCmp;
            return (a.start_time || "").localeCompare(b.start_time || "");
          })
          .map((event) => ({ type: "event", event }) as DisplayItem);
      }
      return (
      groupEventsForDisplay(
        mappedEvents,
        {
          collapseFestivals: true,
          collapseFestivalPrograms: true,
          rollupVenues: false,
          rollupCategories: false,
          sortByTime: false,
        },
      )
      );
    },
    [mappedEvents, useCompactCommunityRows],
  );

  const displayCount = displayItems.length;

  // Update scroll state and active index
  const updateScrollState = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    // Can scroll right if content is wider than container and not at end
    setCanScrollRight(
      scrollWidth > clientWidth && scrollLeft < scrollWidth - clientWidth - 10,
    );
    // Calculate which card is most visible
    const index = Math.round(scrollLeft / (cardWidth + gap));
    setActiveIndex(Math.min(index, Math.max(displayCount - 1, 0)));
  }, [displayCount]);

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

  if (displayCount === 0) {
    return null;
  }

  const renderDisplayItem = (item: DisplayItem, itemIndex: number) => {
    if (item.type === "event") {
      if (useCompactCommunityRows) {
        return (
          <CompactEventCard
            key={item.event.id}
            event={item.event as FeedEventData}
            isAlternate={itemIndex % 2 === 1}
            portalSlug={portalSlug}
          />
        );
      }

      return (
        <GridEventCard
          key={item.event.id}
          event={item.event as FeedEventData}
          isCarousel={isCarousel}
          portalSlug={portalSlug}
        />
      );
    }

    const rollupClassName = isCarousel
      ? "flex-shrink-0 w-72 snap-start"
      : isTwoColumn && !useCompactCommunityRows
        ? "col-span-2"
        : "";

    if (item.type === "series-group") {
      return (
        <SeriesCard
          key={`series-${item.seriesId}`}
          series={item.series}
          venueGroups={item.venueGroups}
          portalSlug={portalSlug}
          skipAnimation
          disableMargin
          density={useCompactCommunityRows ? "compact" : "comfortable"}
          className={rollupClassName}
        />
      );
    }

    if (item.type === "festival-group") {
      return (
        <FestivalCard
          key={`festival-${item.festivalId}`}
          festival={item.festival}
          summary={item.summary}
          portalSlug={portalSlug}
          skipAnimation
          disableMargin
          density={useCompactCommunityRows ? "compact" : "comfortable"}
          className={rollupClassName}
        />
      );
    }

    return null;
  };

  return (
    <section
      className={`mb-4 sm:mb-6 ${isCommunitySection ? `rounded-2xl border border-[var(--twilight)]/55 p-3 sm:p-4 bg-[linear-gradient(150deg,rgba(14,18,28,0.92),rgba(10,13,22,0.7))] border-l-[3px] border-l-[var(--community-accent)] ${communityAccentClass?.className ?? ""}` : ""}`}
    >
      {isCommunitySection && (
        <>
          <ScopedStyles css={communityAccentClass?.css} />
          <div className="mb-2">
            <div className="h-[2px] rounded-full bg-[linear-gradient(to_right,var(--community-accent),transparent)]" />
            <p className="font-mono mt-1.5 text-[0.6rem] uppercase tracking-[0.2em] text-[var(--soft)]">
              Get Involved
            </p>
          </div>
        </>
      )}
      <SectionHeader section={section} portalSlug={portalSlug} />

      {/* Cards container with carousel enhancements */}
      <div
        className={isCarousel ? "relative -mx-4 group/carousel" : "relative"}
      >
        {/* Scroll buttons for desktop - appear on hover */}
        {isCarousel && canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover/carousel:opacity-100 transition-opacity"
            aria-label="Scroll left"
          >
            <div className="w-8 h-8 rounded-full bg-[var(--night)]/90 border border-[var(--twilight)] flex items-center justify-center text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
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
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
        )}

        <div
          ref={scrollRef}
          className={
            isCarousel
              ? "flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory px-4 scroll-smooth"
              : `grid gap-3 ${useCompactCommunityRows ? "grid-cols-1" : isTwoColumn ? "grid-cols-2" : "grid-cols-1"}`
          }
        >
          {displayItems.map((item, itemIndex) =>
            renderDisplayItem(item, itemIndex),
          )}
        </div>

        {/* Mobile scroll indicator dots */}
        {isCarousel && displayCount > 1 && (
          <div className="flex sm:hidden justify-center gap-1.5 mt-3">
            {displayItems.slice(0, Math.min(displayCount, 8)).map((_, idx) => (
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
            {displayCount > 8 && (
              <span className="text-[0.5rem] text-[var(--muted)] ml-1">
                +{displayCount - 8}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================
// COLLAPSIBLE EVENTS - Expandable holiday/themed sections
// ============================================

function CollapsibleEvents({
  section,
  portalSlug,
}: {
  section: FeedSectionData;
  portalSlug: string;
}) {
  if (section.events.length === 0) {
    return null;
  }

  // Check if this is a themed section
  const themedConfig = THEMED_SECTION_ICONS[section.slug];
  const sectionStyle = section.style as { accent_color?: string } | null;

  // Get category from auto_filter for category-based sections
  const filterCategory = section.auto_filter?.categories?.[0];
  const categoryColor = filterCategory
    ? getCategoryColor(filterCategory)
    : null;

  // Use themed color, style color, category color, or fallback to coral
  const accentColor =
    themedConfig?.color ||
    sectionStyle?.accent_color ||
    categoryColor ||
    "var(--coral)";
  const accent = createCssVarClass("--accent-color", accentColor, "accent");

  // Build URL with tag filter - clicking the card navigates to filtered view
  const tag = section.auto_filter?.tags?.[0];
  const filterUrl = tag
    ? `/${portalSlug}?tags=${tag}&view=find`
    : getSeeAllUrl(section, portalSlug);

  return (
    <section className="mb-3">
      {/* Clickable card that navigates to filtered events */}
      <>
        <ScopedStyles css={accent?.css} />
        <Link
          href={filterUrl}
          data-accent
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--twilight)] hover:border-[var(--coral)]/30 transition-all group hover:scale-[1.01] bg-[var(--card-bg)] border-l-[3px] border-l-[var(--accent-color)] ${accent?.className ?? ""}`}
        >
          {/* Icon - themed icon or category icon (larger size) */}
          {themedConfig?.icon ? (
            <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 bg-accent-20">
              <div className="w-10 h-10 text-accent">{themedConfig.icon}</div>
            </div>
          ) : filterCategory ? (
            <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 bg-accent-20">
              <CategoryIcon
                type={filterCategory}
                size={28}
                className="text-accent"
              />
            </div>
          ) : null}

          {/* Title and description */}
          <div className="flex-1 text-left min-w-0">
            <h3 className="font-semibold text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors truncate">
              {section.title}
            </h3>
            {section.description && (
              <p className="font-mono text-xs text-[var(--muted)] truncate">
                {section.description}
              </p>
            )}
          </div>

          {/* Event count badge */}
          <span className="font-mono text-xs px-2 py-1 rounded-full flex-shrink-0 bg-accent-20 text-accent">
            {section.events.length} event
            {section.events.length !== 1 ? "s" : ""}
          </span>

          {/* Arrow indicating navigation */}
          <svg
            className="w-5 h-5 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      </>
    </section>
  );
}

// ============================================
// EVENT LIST - Compact list layout
// ============================================

function EventList({
  section,
  portalSlug,
}: {
  section: FeedSectionData;
  portalSlug: string;
}) {
  const COLLAPSED_ITEM_LIMIT = 10;
  const [isExpanded, setIsExpanded] = useState(false);

  if (section.events.length === 0) {
    return null;
  }

  const renderDisplayItem = (
    item: DisplayItem,
    idx: number,
    showDate: boolean,
  ) => {
    switch (item.type) {
      case "festival-group":
        return (
          <FestivalCard
            key={`festival-${item.festivalId}`}
            festival={item.festival}
            summary={item.summary}
            portalSlug={portalSlug}
            skipAnimation
            density="compact"
          />
        );
      case "series-group":
        return (
          <SeriesCard
            key={`series-${item.seriesId}`}
            series={item.series}
            venueGroups={item.venueGroups}
            portalSlug={portalSlug}
            skipAnimation
            density="compact"
          />
        );
      case "venue-group":
        return (
          <EventGroup
            key={`venue-${item.venueId}`}
            type="venue"
            title={item.venueName}
            events={item.events}
            portalSlug={portalSlug}
            venueSlug={item.venueSlug}
            skipAnimation
            density="compact"
          />
        );
      case "category-group":
        return (
          <EventGroup
            key={`category-${item.categoryId}`}
            type="category"
            title={item.categoryName}
            events={item.events}
            portalSlug={portalSlug}
            skipAnimation
            density="compact"
          />
        );
      case "event":
      default:
        return (
          <CompactEventCard
            key={`event-${item.event.id}`}
            event={item.event as unknown as FeedEventData}
            isAlternate={idx % 2 === 1}
            showDate={showDate}
            portalSlug={portalSlug}
          />
        );
    }
  };

  // Group events into time-of-day buckets for today, date buckets for future
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  // Split events into today vs future
  const todayEvents: FeedEvent[] = [];
  const futureEvents: FeedEvent[] = [];
  for (const event of section.events) {
    if (event.start_date === todayStr) {
      todayEvents.push(event);
    } else {
      futureEvents.push(event);
    }
  }

  // Time-of-day bucket helper
  const getTimeOfDayBucket = (
    startTime: string | null,
    isAllDay: boolean,
  ): { label: string; order: number } => {
    if (isAllDay || !startTime) return { label: "All Day", order: 0 };
    const hour = parseInt(startTime.split(":")[0]);
    if (hour < 12) return { label: "Morning", order: 1 };
    if (hour < 17) return { label: "Afternoon", order: 2 };
    if (hour < 21) return { label: "Evening", order: 3 };
    return { label: "Late Night", order: 4 };
  };

  const buckets: { key: string; label: string; events: FeedEvent[] }[] = [];

  // Build time-of-day buckets for today's events
  if (todayEvents.length > 0) {
    const todBucketMap = new Map<
      string,
      { label: string; order: number; events: FeedEvent[] }
    >();
    for (const event of todayEvents) {
      const { label, order } = getTimeOfDayBucket(
        event.start_time,
        event.is_all_day,
      );
      if (!todBucketMap.has(label)) {
        todBucketMap.set(label, { label, order, events: [] });
      }
      todBucketMap.get(label)!.events.push(event);
    }
    const sortedTodBuckets = Array.from(todBucketMap.values()).sort(
      (a, b) => a.order - b.order,
    );
    for (const b of sortedTodBuckets) {
      buckets.push({
        key: `today-${b.label.toLowerCase().replace(/\s/g, "-")}`,
        label: b.label,
        events: b.events,
      });
    }
  }

  // Build date buckets for future events
  if (futureEvents.length > 0) {
    const dateBucketMap = new Map<string, FeedEvent[]>();
    for (const event of futureEvents) {
      if (!dateBucketMap.has(event.start_date)) {
        dateBucketMap.set(event.start_date, []);
      }
      dateBucketMap.get(event.start_date)!.push(event);
    }
    const sortedDates = Array.from(dateBucketMap.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    for (const [date, events] of sortedDates) {
      buckets.push({
        key: `date-${date}`,
        label: getSmartDateLabel(date),
        events,
      });
    }
  }

  const showBucketHeaders = buckets.length > 1;
  const bucketDisplayGroups = buckets.map((bucket) => ({
    ...bucket,
    displayItems: groupEventsForDisplay(
      bucket.events.map((event) => ({
        ...event,
        category_id: event.category,
      })) as unknown as EventWithLocation[],
      { collapseFestivals: true, collapseFestivalPrograms: true },
    ),
  }));

  const totalDisplayCount = bucketDisplayGroups.reduce(
    (sum, bucket) => sum + bucket.displayItems.length,
    0,
  );
  let remainingSlots = isExpanded
    ? Number.POSITIVE_INFINITY
    : COLLAPSED_ITEM_LIMIT;
  const visibleBucketGroups = bucketDisplayGroups
    .map((bucket) => {
      const available = Number.isFinite(remainingSlots)
        ? Math.max(remainingSlots, 0)
        : bucket.displayItems.length;
      const visibleItems = bucket.displayItems.slice(0, available);
      if (Number.isFinite(remainingSlots)) {
        remainingSlots = Math.max(remainingSlots - visibleItems.length, 0);
      }
      return { ...bucket, visibleItems };
    })
    .filter((bucket) => bucket.visibleItems.length > 0);

  const visibleDisplayCount = visibleBucketGroups.reduce(
    (sum, bucket) => sum + bucket.visibleItems.length,
    0,
  );
  const hiddenDisplayCount = Math.max(
    totalDisplayCount - visibleDisplayCount,
    0,
  );
  const canCollapseBack =
    isExpanded && totalDisplayCount > COLLAPSED_ITEM_LIMIT;

  return (
    <section className="mb-4 sm:mb-6">
      <SectionHeader section={section} portalSlug={portalSlug} />

      {/* List grouped by progressive date buckets */}
      <div className="space-y-4">
        {visibleBucketGroups.map((bucket) => (
          <div key={bucket.key}>
            {/* Bucket header */}
            {showBucketHeaders && (
              <div
                data-accent
                className="group flex items-center gap-3 mb-2 px-3 py-2 -mx-3 rounded-lg cursor-default transition-all hover:bg-[var(--twilight)]/20 card-atmospheric glow-accent reflection-accent"
              >
                <span className="font-mono text-xs font-medium text-[var(--coral)] transition-all group-hover:text-glow">
                  {bucket.label}
                </span>
                <div className="flex-1 h-px bg-[var(--twilight)]/50" />
              </div>
            )}
            {/* Events for this bucket */}
            <div className="space-y-2">
              {bucket.visibleItems.map((item, idx) =>
                renderDisplayItem(item, idx, !showBucketHeaders),
              )}
            </div>
          </div>
        ))}

        {(hiddenDisplayCount > 0 || canCollapseBack) && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="w-full rounded-xl border border-[var(--twilight)]/50 bg-[var(--night)]/55 px-4 py-3 text-left transition-all duration-200 hover:border-[var(--coral)]/45 hover:bg-[var(--night)]/75"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-[var(--muted)]">
                    Section Density
                  </p>
                  <p className="text-sm text-[var(--cream)] font-medium">
                    {hiddenDisplayCount > 0
                      ? `Show ${hiddenDisplayCount} more`
                      : "Show fewer items"}
                  </p>
                </div>
                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-[var(--coral)]/40 px-2 font-mono text-xs text-[var(--coral)]">
                  {hiddenDisplayCount > 0 ? `+${hiddenDisplayCount}` : "−"}
                </span>
              </div>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================
// NIGHTLIFE CAROUSEL - Interactive activity type filter + event list
// ============================================

// Neon color overrides for activities that don't have a CATEGORY_CONFIG entry.
// For activities with a matching category (comedy, music, dance, nightlife, gaming),
// we use getCategoryColor() at render time instead.
const NIGHTLIFE_ACTIVITIES: Record<
  string,
  { neonOverride?: string; icon: ComponentType<IconProps> }
> = {
  karaoke: { neonOverride: "#FF6EB4", icon: MicrophoneStage },
  trivia: { neonOverride: "#F5A623", icon: Question },
  bar_games: { neonOverride: "#00D9A0", icon: Target },
  poker: { neonOverride: "#FF5A5A", icon: Spade },
  bingo: { neonOverride: "#C084FC", icon: GridFour },
  dj: { neonOverride: "#00D4E8", icon: Headphones },
  drag: { neonOverride: "#E855A0", icon: Crown },
  latin_night: { neonOverride: "#FF8C42", icon: Guitar },
  line_dancing: { neonOverride: "#FFD93D", icon: CowboyHat },
  party: { neonOverride: "#818CF8", icon: Confetti },
  pub_crawl: { neonOverride: "#86EFAC", icon: BeerStein },
  specials: { neonOverride: "#38BDF8", icon: Tag },
  live_music: { icon: Waveform }, // uses getCategoryColor("music")
  comedy: { icon: Smiley }, // uses getCategoryColor("comedy")
  dance: { icon: DiscoBall }, // uses getCategoryColor("dance")
  other: { neonOverride: "#94A3B8", icon: MoonStars },
};

// Resolve neon color: prefer CATEGORY_CONFIG color, then activity override, then fallback
const CATEGORY_COLOR_MAP: Record<string, string> = {
  live_music: "music",
  comedy: "comedy",
  dance: "dance",
};
function getNeonColor(activityId: string): string {
  const catKey = CATEGORY_COLOR_MAP[activityId];
  if (catKey) {
    const c = getCategoryColor(catKey);
    if (c && c !== "#8B8B94") return c; // skip the "other" default gray
  }
  return NIGHTLIFE_ACTIVITIES[activityId]?.neonOverride || "#94A3B8";
}

function NightlifeCarousel({
  section,
  portalSlug,
  isFirst,
}: {
  section: FeedSectionData;
  portalSlug: string;
  isFirst?: boolean;
}) {
  const content = section.block_content as {
    nightlife_categories?: Array<{ id: string; label: string; count: number }>;
    total_events?: number;
  } | null;

  const categories = content?.nightlife_categories || [];
  const totalEvents = content?.total_events || 0;
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [expandedByActivity, setExpandedByActivity] = useState<
    Record<string, boolean>
  >({});
  const COLLAPSED_LIMIT = 8;
  const activityKey = selectedActivity ?? "__all";
  const isExpanded = expandedByActivity[activityKey] ?? false;

  // Filter events by selected activity
  const filteredEvents = useMemo(() => {
    if (!selectedActivity) return section.events;
    return section.events.filter(
      (e) =>
        (e as FeedEvent & { activity_type?: string }).activity_type ===
        selectedActivity,
    );
  }, [section.events, selectedActivity]);

  // Compute visible events with collapse logic
  const { visibleEvents, hiddenCount } = useMemo(() => {
    if (isExpanded) {
      return { visibleEvents: filteredEvents, hiddenCount: 0 };
    }
    const visible = filteredEvents.slice(0, COLLAPSED_LIMIT);
    return {
      visibleEvents: visible,
      hiddenCount: Math.max(filteredEvents.length - COLLAPSED_LIMIT, 0),
    };
  }, [filteredEvents, isExpanded]);

  const handleToggleExpanded = useCallback(() => {
    setExpandedByActivity((prev) => ({
      ...prev,
      [activityKey]: !(prev[activityKey] ?? false),
    }));
  }, [activityKey]);

  if (categories.length === 0) return null;

  const handleCardClick = (catId: string) => {
    setSelectedActivity((prev) => (prev === catId ? null : catId));
  };

  return (
    <section className={`mb-6 sm:mb-10 ${isFirst ? "" : "pt-2"}`}>
      {/* Neon header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h3
            className="text-xl sm:text-2xl font-bold tracking-tight"
            style={{
              color: "#E855A0",
              textShadow:
                "0 0 7px rgba(232,85,160,0.6), 0 0 20px rgba(232,85,160,0.25)",
            }}
          >
            Going Out?
          </h3>
        </div>
        <Link
          href={`/${portalSlug}?view=find&type=events&categories=nightlife`}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-mono transition-all group"
          style={{
            color: "#E855A0",
            textShadow: "0 0 8px rgba(232,85,160,0.4)",
          }}
        >
          All {totalEvents}
          <svg
            className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      </div>

      {/* Horizontal scrolling neon cards — interactive filter */}
      <div className="flex gap-3 overflow-x-auto py-2 -my-2 scrollbar-hide scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0">
        {/* "All" card */}
        <button
          type="button"
          onClick={() => setSelectedActivity(null)}
          className="flex-shrink-0 w-[130px] sm:w-[150px] text-left"
        >
          <div
            className="relative overflow-hidden rounded-xl p-3.5 h-[110px] sm:h-[120px] flex flex-col justify-between transition-all duration-200 hover:scale-[1.04]"
            style={{
              background: "var(--night, #0F0F14)",
              border: `1px solid color-mix(in srgb, #E855A0 ${selectedActivity === null ? "60%" : "20%"}, transparent)`,
              boxShadow:
                selectedActivity === null
                  ? "inset 0 0 24px color-mix(in srgb, #E855A0 12%, transparent), 0 0 16px color-mix(in srgb, #E855A0 25%, transparent)"
                  : "inset 0 0 20px color-mix(in srgb, #E855A0 4%, transparent)",
              opacity: selectedActivity !== null ? 0.5 : 1,
            }}
          >
            <div
              className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-30 pointer-events-none"
              style={{ background: "#E855A0" }}
            />
            <MoonStars
              size={28}
              weight="light"
              className="relative z-10 icon-neon"
              style={{ color: "#E855A0" }}
            />
            <div className="relative z-10">
              <div
                className="font-semibold text-[0.8rem] sm:text-sm leading-tight tracking-tight"
                style={{
                  color: "#E855A0",
                  textShadow:
                    "0 0 8px color-mix(in srgb, #E855A0 50%, transparent)",
                }}
              >
                All
              </div>
              <div className="font-mono text-[0.6rem] text-[var(--muted)] mt-0.5">
                {totalEvents} tonight
              </div>
            </div>
          </div>
        </button>

        {categories.map((cat) => {
          const activity =
            NIGHTLIFE_ACTIVITIES[cat.id] || NIGHTLIFE_ACTIVITIES.other;
          const ActivityIcon = activity.icon;
          const neon = getNeonColor(cat.id);
          const isSelected = selectedActivity === cat.id;
          const hasSomeSelection = selectedActivity !== null;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCardClick(cat.id)}
              className="flex-shrink-0 w-[130px] sm:w-[150px] text-left"
            >
              <div
                className="relative overflow-hidden rounded-xl p-3.5 h-[110px] sm:h-[120px] flex flex-col justify-between transition-all duration-200 hover:scale-[1.04]"
                style={{
                  background: isSelected
                    ? `color-mix(in srgb, ${neon} 8%, var(--night, #0F0F14))`
                    : "var(--night, #0F0F14)",
                  border: `1px solid color-mix(in srgb, ${neon} ${isSelected ? "60%" : "35%"}, transparent)`,
                  boxShadow: isSelected
                    ? `inset 0 0 24px color-mix(in srgb, ${neon} 12%, transparent), 0 0 16px color-mix(in srgb, ${neon} 25%, transparent)`
                    : `inset 0 0 20px color-mix(in srgb, ${neon} 6%, transparent), 0 0 12px color-mix(in srgb, ${neon} 15%, transparent)`,
                  opacity: hasSomeSelection && !isSelected ? 0.5 : 1,
                }}
              >
                {/* Corner glow */}
                <div
                  className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-30 pointer-events-none"
                  style={{ background: neon }}
                />

                {/* Phosphor icon with neon glow */}
                <ActivityIcon
                  size={28}
                  weight="light"
                  className="relative z-10 icon-neon"
                  style={{
                    color: neon,
                    filter: `drop-shadow(0 0 6px ${neon})`,
                  }}
                />

                {/* Label + count */}
                <div className="relative z-10">
                  <div
                    className="font-semibold text-[0.8rem] sm:text-sm leading-tight tracking-tight"
                    style={{
                      color: neon,
                      textShadow: `0 0 8px color-mix(in srgb, ${neon} 50%, transparent)`,
                    }}
                  >
                    {cat.label}
                  </div>
                  <div className="font-mono text-[0.6rem] text-[var(--muted)] mt-0.5">
                    {cat.count} tonight
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filtered event list */}
      <div
        className="mt-4 transition-opacity duration-150"
        style={{ opacity: filteredEvents.length > 0 ? 1 : 0.6 }}
      >
        {filteredEvents.length === 0 ? (
          <div className="text-center py-6">
            <p className="font-mono text-sm text-[var(--muted)]">
              Nothing tonight in this category
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleEvents.map((event, idx) => (
              <CompactEventCard
                key={event.id}
                event={event as unknown as FeedEventData}
                isAlternate={idx % 2 === 1}
                showDate={false}
                portalSlug={portalSlug}
              />
            ))}

            {(hiddenCount > 0 ||
              (isExpanded && filteredEvents.length > COLLAPSED_LIMIT)) && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleToggleExpanded}
                  className="w-full rounded-xl border border-[var(--twilight)]/50 bg-[var(--night)]/55 px-4 py-3 text-left transition-all duration-200 hover:border-[var(--coral)]/45 hover:bg-[var(--night)]/75"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-[var(--cream)] font-medium">
                      {hiddenCount > 0
                        ? `Show ${hiddenCount} more`
                        : "Show fewer"}
                    </p>
                    <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-[var(--coral)]/40 px-2 font-mono text-xs text-[var(--coral)]">
                      {hiddenCount > 0 ? `+${hiddenCount}` : "\u2212"}
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================
// CATEGORY GRID - Quick links to categories
// ============================================

function CategoryGrid({
  section,
  portalSlug,
  isFirst,
}: {
  section: FeedSectionData;
  portalSlug: string;
  isFirst?: boolean;
}) {
  const content = section.block_content as {
    categories?: Array<{
      id: string;
      label: string;
      icon: string;
      count?: number;
    }>;
  } | null;

  const categories = content?.categories || [];

  if (categories.length === 0) {
    return null;
  }

  return (
    <section className={`mb-6 sm:mb-10 ${isFirst ? "" : "pt-2"}`}>
      {/* Header */}
      {section.title && (
        <h3 className="text-lg font-semibold tracking-tight text-[var(--cream)] mb-4">
          {section.title}
        </h3>
      )}

      {/* Grid with larger touch targets */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/${portalSlug}?view=find&type=events&categories=${cat.id}`}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[var(--twilight)] hover:border-[var(--coral)]/50 transition-all group min-h-[80px] relative bg-[var(--card-bg)]"
          >
            <CategoryIcon
              type={cat.id}
              size={28}
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
        ))}
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
  series_slug: string | null;
};

function compareShowtimeDateTime(a: VenueShowtime, b: VenueShowtime): number {
  const dateCmp = a.start_date.localeCompare(b.start_date);
  if (dateCmp !== 0) return dateCmp;
  return (a.start_time || "").localeCompare(b.start_time || "");
}

// Group events by title to combine showtimes
function groupEventsByTitle(
  events: VenueShowtime[],
): {
  title: string;
  category: string | null;
  series_slug: string | null;
  events: VenueShowtime[];
}[] {
  const groups = new Map<
    string,
    {
      title: string;
      category: string | null;
      series_slug: string | null;
      events: VenueShowtime[];
    }
  >();

  for (const event of events) {
    const key = event.title.toLowerCase().trim();
    if (!groups.has(key)) {
      groups.set(key, {
        title: event.title,
        category: event.category,
        series_slug: event.series_slug,
        events: [],
      });
    }
    groups.get(key)!.events.push(event);
  }

  // Sort each group's events by date then time
  for (const group of groups.values()) {
    group.events.sort(compareShowtimeDateTime);
  }

  // Return groups sorted by earliest showtime
  return Array.from(groups.values()).sort((a, b) => {
    const aFirst = a.events[0];
    const bFirst = b.events[0];
    if (!aFirst || !bFirst) return 0;
    return compareShowtimeDateTime(aFirst, bFirst);
  });
}

// Sub-group a film's events by date, deduplicating same-time events on the same date
function groupEventsByDate(
  events: VenueShowtime[],
): { dateLabel: string; date: string; events: VenueShowtime[] }[] {
  const dateMap = new Map<string, VenueShowtime[]>();

  for (const event of events) {
    const date = event.start_date;
    if (!dateMap.has(date)) {
      dateMap.set(date, []);
    }
    // Deduplicate: skip if same time already exists for this date
    const existing = dateMap.get(date)!;
    if (!existing.some((e) => e.start_time === event.start_time)) {
      existing.push(event);
    }
  }

  // Sort dates chronologically, times within each date
  const sorted = Array.from(dateMap.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return sorted.map(([date, evts]) => ({
    dateLabel: getSmartDateLabel(date),
    date,
    events: evts.sort(compareShowtimeDateTime),
  }));
}

function VenueList({
  section,
  portalSlug,
}: {
  section: FeedSectionData;
  portalSlug: string;
}) {
  const content = section.block_content as {
    venues?: Array<{
      id: number;
      name: string;
      slug: string;
      description?: string;
    }>;
  } | null;

  const venues = content?.venues || [];
  const [expandedVenues, setExpandedVenues] = useState<Set<number>>(new Set());
  const [venueEvents, setVenueEvents] = useState<
    Record<number, VenueShowtime[]>
  >({});
  const [loadingVenues, setLoadingVenues] = useState<Set<number>>(new Set());

  const toggleVenue = async (venueId: number) => {
    const newExpanded = new Set(expandedVenues);

    if (newExpanded.has(venueId)) {
      newExpanded.delete(venueId);
    } else {
      newExpanded.add(venueId);

      // Fetch events if not already loaded
      if (!venueEvents[venueId]) {
        setLoadingVenues((prev) => new Set(prev).add(venueId));
        try {
          const params = new URLSearchParams({ limit: "20" });
          if (portalSlug) params.set("portal", portalSlug);
          const res = await fetch(
            `/api/venues/${venueId}/events?${params.toString()}`,
          );
          if (res.ok) {
            const data = await res.json();
            setVenueEvents((prev) => ({
              ...prev,
              [venueId]: data.events || [],
            }));
          }
        } catch (err) {
          console.error("Failed to fetch venue events:", err);
        } finally {
          setLoadingVenues((prev) => {
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

  const headerTitle = "Go see movies";
  const headerSubtitle = section.description || undefined;

  return (
    <section className="mb-4 sm:mb-6">
      <FeedSectionHeader
        title={headerTitle}
        subtitle={headerSubtitle}
        priority="tertiary"
        accentColor={getCategoryColor("film")}
        icon={
          <CategoryIcon
            type="film"
            size={18}
            glow="none"
            className="text-[var(--section-accent)]"
          />
        }
      />

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
              data-category="film"
              data-accent="category"
              className="rounded-lg border border-[var(--twilight)] overflow-hidden bg-[var(--card-bg)] border-l-[3px] border-l-[var(--accent-color)]"
            >
              {/* Venue header - clickable to expand */}
              <button
                type="button"
                onClick={() => toggleVenue(venue.id)}
                className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-[var(--twilight)]/20 transition-colors"
              >
                <CategoryIcon
                  type="film"
                  size={16}
                  className="flex-shrink-0 opacity-70"
                />
                <div className="flex-1 min-w-0 text-left">
                  <span className="font-medium text-sm text-[var(--cream)] truncate block">
                    {venue.name}
                  </span>
                  {venue.description && (
                    <span className="text-xs text-[var(--muted)]">
                      <LinkifyText text={venue.description} />
                    </span>
                  )}
                </div>
                {events.length > 0 && (
                  <span className="font-mono text-[0.6rem] text-[var(--muted)] bg-[var(--twilight)]/50 px-1.5 py-0.5 rounded">
                    {groupedEvents.length}{" "}
                    {groupedEvents.length === 1 ? "film" : "films"}
                  </span>
                )}
                <svg
                  className={`w-4 h-4 text-[var(--muted)] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {/* Expanded showtimes */}
              {isExpanded && (
                <div className="border-t border-[var(--twilight)]/30">
                  {isLoading ? (
                    <div className="px-3 py-3 text-center">
                      <span className="font-mono text-xs text-[var(--muted)]">
                        Loading showtimes...
                      </span>
                    </div>
                  ) : groupedEvents.length === 0 ? (
                    <div className="px-3 py-3 text-center">
                      <span className="font-mono text-xs text-[var(--muted)]">
                        No upcoming showtimes
                      </span>
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
                            <CategoryIcon
                              type="film"
                              size={12}
                              className="flex-shrink-0 opacity-50"
                            />
                            {group.series_slug ? (
                              <Link
                                href={`/${portalSlug}/series/${group.series_slug}`}
                                className="text-sm text-[var(--cream)] truncate hover:underline"
                              >
                                {group.title}
                              </Link>
                            ) : (
                              <span className="text-sm text-[var(--cream)] truncate">
                                {group.title}
                              </span>
                            )}
                          </div>

                          {/* Showtimes by date */}
                          {(() => {
                            const dateGroups = groupEventsByDate(group.events);
                            const multiDate = dateGroups.length > 1;
                            return (
                              <div
                                className={`ml-5 ${multiDate ? "space-y-1" : ""}`}
                              >
                                {dateGroups.map((dg) => {
                                  const showDateLabel =
                                    multiDate || dg.dateLabel !== "Today";
                                  return (
                                    <div
                                      key={dg.date}
                                      className="flex items-baseline gap-2"
                                    >
                                      {showDateLabel && (
                                      <span className="font-mono text-[0.6rem] text-[var(--muted)] w-16 flex-shrink-0 truncate">
                                        {dg.dateLabel}
                                      </span>
                                      )}
                                      <div className="flex flex-wrap gap-1.5">
                                        {dg.events.map((event) => (
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
                                  );
                                })}
                              </div>
                            );
                          })()}
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
  const accent = createCssVarClass("--accent-color", accentColor, "accent");
  const bg = createCssVarClass(
    "--announcement-bg",
    style?.background_color || content.background_color || "var(--dusk)",
    "announcement-bg",
  );
  const border = createCssVarClass(
    "--announcement-border",
    style?.border_color || "var(--twilight)",
    "announcement-border",
  );
  const text = createCssVarClass(
    "--announcement-text",
    style?.text_color || content.text_color || "var(--cream)",
    "announcement-text",
  );

  return (
    <section className="mb-4 sm:mb-6">
      <ScopedStyles css={accent?.css} />
      <ScopedStyles css={bg?.css} />
      <ScopedStyles css={border?.css} />
      <ScopedStyles css={text?.css} />
      <div
        data-accent
        className={`p-5 rounded-xl border-l-4 border announcement-card ${
          accent?.className ?? ""
        } ${bg?.className ?? ""} ${border?.className ?? ""} ${text?.className ?? ""}`}
      >
        <div className="flex gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-accent-20">
            <svg
              className="w-5 h-5 text-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
              />
            </svg>
          </div>

          {/* Content */}
          <div className="flex-1">
            {section.title && (
              <h3 className="text-lg font-semibold tracking-tight mb-1 announcement-title">
                {section.title}
              </h3>
            )}
            <p className="font-mono text-sm leading-relaxed announcement-body">
              {content.text}
            </p>
            {content.cta_url &&
              content.cta_text &&
              isSafeUrl(content.cta_url) && (
                <Link
                  href={content.cta_url}
                  data-accent
                  className={`inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg font-mono text-sm font-medium transition-colors bg-accent text-[var(--void)] ${accent?.className ?? ""}`}
                >
                  {content.cta_text}
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
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

  if (!content?.url || !isSafeUrl(content.url)) {
    return null;
  }

  return (
    <section className="mb-4 sm:mb-6">
      <a
        href={content.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 p-4 rounded-xl border border-[var(--twilight)] hover:border-[var(--coral)]/30 transition-all group bg-[var(--card-bg)]"
        aria-label={`${section.title} (opens in new tab)`}
      >
        {content.image_url && (
          <div className="relative w-16 h-16 rounded-lg bg-[var(--twilight)] flex-shrink-0 overflow-hidden">
            <Image
              src={content.image_url}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
            />
          </div>
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
