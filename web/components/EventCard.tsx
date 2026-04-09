"use client";

import { Fragment, memo, useState, useCallback, useMemo } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import type { Event } from "@/lib/supabase";
import {
  decodeHtmlEntities,
  formatTimeSplit,
  formatSmartDate,
  formatPriceDetailed,
  formatCompactCount,
  formatTime,
  formatExhibitionDate,
} from "@/lib/formats";
import CategoryIcon, {
  getCategoryColor,
  getCategoryLabel,
  type CategoryType,
} from "./CategoryIcon";
import {
  getReflectionClass,
  isTicketingUrl,
  getLinkOutLabel,
  getSmartDateLabel,
  getFeedEventStatus,
} from "@/lib/card-utils";
import { getCivicEventHref } from "@/lib/civic-routing";
import { LiveBadge, SoonBadge, FreeBadge } from "./Badge";
import Image from "@/components/SmartImage";
import type { RecommendationReason } from "./ReasonBadge";
import RSVPButton, { type RSVPStatus } from "./RSVPButton";
import { useImageParallax } from "@/lib/hooks/useImageParallax";
import { usePointerGlow } from "@/lib/hooks/usePointerGlow";
import type { Frequency, DayOfWeek } from "@/lib/recurrence";
import Dot from "@/components/ui/Dot";
import { EventCardImage } from "./event-card/EventCardImage";
import { EventCardBadges } from "./event-card/EventCardBadges";
import { EventCardMetadata } from "./event-card/EventCardMetadata";
import { EventCardActions } from "./event-card/EventCardActions";
import { EventCardSocialProof } from "./event-card/EventCardSocialProof";
import type { FriendGoing } from "./event-card/types";
import { PressQuote } from "@/components/feed/PressQuote";
import type { EditorialMention } from "@/lib/city-pulse/types";

// Re-export FriendGoing so external consumers don't need to change imports
export type { FriendGoing };

type LocationDesignator =
  | "standard"
  | "private_after_signup"
  | "virtual"
  | "recovery_meeting"
  | null
  | undefined;

type EventCardEvent = Event & {
  is_live?: boolean;
  festival_id?: string | null;
  is_tentpole?: boolean;
  venue?:
    | (Event["venue"] & {
        typical_price_min?: number | null;
        typical_price_max?: number | null;
      })
    | null;
  category_data?: {
    typical_price_min: number | null;
    typical_price_max: number | null;
  } | null;
  series?: {
    id: string;
    title: string;
    series_type: string;
    image_url?: string | null;
    blurhash?: string | null;
    frequency?: Frequency;
    day_of_week?: DayOfWeek;
  } | null;
  blurhash?: string | null;
  is_class?: boolean;
  class_category?: string | null;
  skill_level?: string | null;
  instructor?: string | null;
  going_count?: number;
  interested_count?: number;
  recommendation_count?: number;
};

// Minimal event data for feed variants (grid, compact, hero, trending)
export type FeedEventData = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_date?: string | null;
  end_time?: string | null;
  is_all_day: boolean;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  category: string | null;
  subcategory?: string | null;
  tags?: string[] | null;
  genres?: string[] | null;
  image_url: string | null;
  blurhash?: string | null;
  description?: string | null;
  featured_blurb?: string | null;
  going_count?: number;
  interested_count?: number;
  recommendation_count?: number;
  is_trending?: boolean;
  activity_type?: string;
  festival_id?: string | null;
  is_tentpole?: boolean;
  is_featured?: boolean;
  importance?: "flagship" | "major" | "standard" | null;
  ticket_url?: string | null;
  source_url?: string | null;
  source_slug?: string | null;
  // Taxonomy v2 derived attributes
  cost_tier?: string | null;
  duration?: string | null;
  booking_required?: boolean | null;
  indoor_outdoor?: string | null;
  significance?: string | null;
  significance_signals?: string[] | null;
  series_id?: string | null;
  series?: {
    id: string;
    slug?: string;
    title: string;
    series_type: string;
    image_url?: string | null;
    blurhash?: string | null;
    frequency?: string | null;
    day_of_week?: string | null;
  } | null;
  entity_type?: "event" | "festival";
  canonical_key?: string | null;
  canonical_tier?: "tier_a" | "tier_b" | null;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
    slug?: string | null;
    image_url?: string | null;
    blurhash?: string | null;
    location_designator?: LocationDesignator;
    google_rating?: number | null;
    google_rating_count?: number | null;
  } | null;
};

interface Props {
  event: EventCardEvent;
  index?: number;
  skipAnimation?: boolean;
  portalSlug?: string;
  friendsGoing?: FriendGoing[];
  /** Recommendation reasons for personalization */
  reasons?: RecommendationReason[];
  /** Context type for filtering redundant reason badges */
  contextType?: "interests" | "venue" | "producer" | "neighborhood";
  /** Callback when user hides the event */
  onHide?: () => void;
  /** List density mode */
  density?: "comfortable" | "compact";
  /** Portal vertical — used for civic routing (e.g. "community") */
  vertical?: string | null;
  /** Editorial press mentions to show below venue name */
  editorialMentions?: EditorialMention[];
}

function EventCard({
  event,
  index = 0,
  skipAnimation = false,
  portalSlug,
  friendsGoing = [],
  reasons,
  contextType,
  density = "comfortable",
  vertical,
  editorialMentions,
}: Props) {
  const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);
  // Use exhibition date formatting for multi-week exhibitions (>7 day duration with end_date)
  const dateInfo = (() => {
    if (event.end_date) {
      const start = new Date(event.start_date + "T00:00:00");
      const end = new Date(event.end_date + "T00:00:00");
      const durationDays =
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      if (durationDays > 7) {
        return formatExhibitionDate(event.start_date, event.end_date);
      }
    }
    return formatSmartDate(event.start_date);
  })();
  const isLive = event.is_live || false;
  // Only apply stagger animation to first 10 initial items, not infinite scroll items
  const staggerClass =
    !skipAnimation && index < 10 ? `stagger-${index + 1}` : "";
  const animationClass = skipAnimation ? "" : "animate-card-emerge";
  const accentColor = event.category
    ? getCategoryColor(event.category)
    : "var(--neon-magenta)";
  const reflectionClass = getReflectionClass(event.category);
  const price = formatPriceDetailed(event);
  const eventTitle = decodeHtmlEntities(event.title);
  const venueName = event.venue?.name
    ? decodeHtmlEntities(event.venue.name)
    : null;
  const venueNeighborhood = event.venue?.neighborhood
    ? decodeHtmlEntities(event.venue.neighborhood)
    : null;
  const locationLabel = getLocationDesignatorLabel(
    event.venue?.location_designator,
  );
  const instructorName = event.instructor
    ? decodeHtmlEntities(event.instructor)
    : null;
  const railImageUrl = event.image_url ?? event.series?.image_url ?? event.venue?.image_url ?? undefined;
  const railBlurhash = event.blurhash || event.series?.blurhash || null;
  const hasRailImage = Boolean(railImageUrl);

  const { containerRef: parallaxContainerRef, imageRef: parallaxImageRef } =
    useImageParallax();
  const glowRef = usePointerGlow<HTMLDivElement>();
  // Optimistic RSVP count adjustments — user's own RSVP immediately ticks the count
  const [countAdjust, setCountAdjust] = useState({
    going: 0,
    interested: 0,
    recommendation: 0,
  });

  const handleRSVPChange = useCallback(
    (newStatus: RSVPStatus, prevStatus: RSVPStatus) => {
      setCountAdjust((prev) => {
        const next = { ...prev };
        // Remove contribution from previous status
        if (prevStatus === "going") next.going -= 1;
        else if (prevStatus === "interested") next.interested -= 1;
        else if (prevStatus === "went") next.recommendation -= 1;
        // Add contribution from new status
        if (newStatus === "going") next.going += 1;
        else if (newStatus === "interested") next.interested += 1;
        else if (newStatus === "went") next.recommendation += 1;
        return next;
      });
    },
    [],
  );

  const goingCount = (event.going_count ?? 0) + countAdjust.going;
  const interestedCount =
    (event.interested_count ?? 0) + countAdjust.interested;
  const recommendationCount =
    (event.recommendation_count ?? 0) + countAdjust.recommendation;
  const hasSocialProof =
    goingCount > 0 || interestedCount > 0 || recommendationCount > 0;

  // Build detail href - civic portals route to dedicated pages; others use modal
  const eventHref = useMemo(() => {
    if (!portalSlug) return `/events/${event.id}`;
    const civicHref = getCivicEventHref({ id: event.id, category: event.category }, portalSlug, vertical);
    if (civicHref) return civicHref;
    return `/${portalSlug}/events/${event.id}`;
  }, [portalSlug, event.id, event.category, vertical]);
  const linkOutUrl = event.ticket_url || event.source_url || eventHref;
  const isExternalLinkOut = Boolean(event.ticket_url || event.source_url);
  const linkOutLabel = getLinkOutLabel({
    url: linkOutUrl,
    hasTicketUrl: Boolean(event.ticket_url),
    isExternal: isExternalLinkOut,
  });
  const isTicketLinkOut =
    Boolean(event.ticket_url) || isTicketingUrl(event.source_url);
  const compactTimeLabel = event.is_all_day
    ? "All Day"
    : `${time}${period ? ` ${period}` : ""}`;
  const compactCategoryLabel = event.category
    ? getCategoryLabel(event.category as CategoryType)
    : null;

  if (density === "compact") {
    return (
      <div
        className={`find-row-card pointer-glow mb-2.5 rounded-xl border border-[var(--twilight)]/75 ${reflectionClass} ${animationClass} ${staggerClass} overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] ${
          event.category ? "border-l-[2px] border-l-[var(--accent-color)]" : ""
        }`}
        tabIndex={0}
        data-list-row="true"
        aria-label={`${eventTitle}, ${dateInfo.label} ${event.is_all_day ? "all day" : `${time} ${period || ""}`}`}
        style={
          {
            "--accent-color": accentColor,
            "--cta-border":
              "color-mix(in srgb, var(--accent-color) 70%, transparent)",
            "--cta-glow":
              "color-mix(in srgb, var(--accent-color) 35%, transparent)",
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--night) 84%, transparent), color-mix(in srgb, var(--dusk) 72%, transparent))",
          } as CSSProperties
        }
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2.5 sm:px-3 py-2.5">
          <Link
            href={eventHref}
            data-row-primary-link="true"
            className="min-w-0"
          >
            <div className="min-w-0 space-y-1.5 sm:space-y-1">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <span className="flex-shrink-0 font-mono text-xs sm:text-xs font-semibold uppercase tracking-[0.1em] text-[var(--accent-color)] min-w-[68px] sm:min-w-[82px]">
                  {compactTimeLabel}
                </span>
                {compactCategoryLabel && (
                  <span className="ml-auto inline-block max-w-[84px] sm:max-w-[120px] truncate flex-shrink-0 font-mono text-2xs sm:text-2xs font-medium uppercase tracking-[0.1em] text-[var(--muted)]">
                    {compactCategoryLabel}
                  </span>
                )}
              </div>
              <span className="block text-base sm:text-base font-semibold leading-[1.2] line-clamp-2 sm:line-clamp-1 text-[var(--cream)] group-hover:text-[var(--accent-color)] transition-colors">
                {eventTitle}
              </span>
              <div className="flex items-center gap-1.5 min-w-0 text-xs leading-[1.2] sm:text-xs text-[var(--soft)]">
                {venueName ? (
                  <>
                    <span className="truncate max-w-[62%]" title={venueName}>
                      {venueName}
                    </span>
                    {venueNeighborhood && (
                      <>
                        <Dot />
                        <span
                          className="truncate text-[var(--muted)]"
                          title={venueNeighborhood}
                        >
                          {venueNeighborhood}
                        </span>
                      </>
                    )}
                    {locationLabel && (
                      <>
                        <Dot />
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-[var(--twilight)]/70 bg-[var(--twilight)]/40 text-2xs uppercase tracking-[0.08em] text-[var(--soft)]">
                          {locationLabel}
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  <span className="truncate">{dateInfo.label}</span>
                )}
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-1.5">
            <div data-row-save-action="true">
              <RSVPButton
                eventId={event.id}
                variant="compact"
                onRSVPChange={handleRSVPChange}
                className="list-save-trigger"
              />
            </div>
            {isExternalLinkOut && (
              <a
                href={linkOutUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={linkOutLabel}
                data-row-open-action="true"
                className="hidden sm:inline-flex w-9 h-9 items-center justify-center rounded-lg border border-[var(--twilight)]/75 bg-[var(--dusk)]/72 text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--cta-border,rgba(255,107,122,0.7))] hover:shadow-[0_0_14px_var(--cta-glow,rgba(255,107,122,0.2))] transition-all"
              >
                {isTicketLinkOut ? (
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
                      d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                    />
                  </svg>
                ) : (
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
                      d="M14 3h7v7m0-7L10 14"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 10v8a1 1 0 001 1h8"
                    />
                  </svg>
                )}
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={glowRef}
      className={`find-row-card find-row-card-bg pointer-glow mb-2.5 sm:mb-3 rounded-xl border border-[var(--twilight)]/75 ${reflectionClass} ${animationClass} ${staggerClass} overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] ${
        event.category ? "border-l-[2px] border-l-[var(--accent-color)]" : ""
      }`}
      tabIndex={0}
      data-list-row="true"
      aria-label={`${eventTitle}, ${dateInfo.label} ${event.is_all_day ? "all day" : `${time} ${period || ""}`}`}
      style={
        {
          "--accent-color": accentColor,
          "--cta-border":
            "color-mix(in srgb, var(--accent-color) 70%, transparent)",
          "--cta-glow":
            "color-mix(in srgb, var(--accent-color) 35%, transparent)",
        } as CSSProperties
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:gap-3">
        <Link
          href={eventHref}
          data-row-primary-link="true"
          className="block min-w-0 p-3 sm:p-3.5"
        >
          <div className="flex gap-2.5 sm:gap-3">
            {/* Time/image rail — desktop only */}
            <EventCardImage
              eventId={event.id}
              railImageUrl={railImageUrl}
              railBlurhash={railBlurhash}
              hasRailImage={hasRailImage}
              parallaxContainerRef={parallaxContainerRef}
              parallaxImageRef={parallaxImageRef}
              time={time}
              period={period}
              dateInfo={dateInfo}
              category={event.category}
              eventTitle={eventTitle}
              isAllDay={event.is_all_day}
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Mobile: Stacked layout for more title space */}
              <div className="sm:hidden">
                {/* Top row: inline time + category icon + status badges */}
                <div className="flex items-center gap-2 mb-2">
                  {/* Inline time badge — replaces the hidden time column on mobile */}
                  <span
                    className={`inline-flex items-baseline gap-1 font-mono text-base font-bold leading-none ${
                      dateInfo.isHighlight
                        ? "text-[var(--accent-color)]"
                        : "text-[var(--cream)]"
                    }`}
                  >
                    {event.is_all_day ? (
                      <span className="text-2xs font-semibold text-[var(--soft)] uppercase tracking-[0.12em]">
                        All Day
                      </span>
                    ) : (
                      <>
                        {time}
                        {period && (
                          <span className="text-2xs font-medium text-[var(--soft)] uppercase tracking-[0.1em]">
                            {period}
                          </span>
                        )}
                      </>
                    )}
                  </span>
                  {event.category && (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-accent-20 border border-[var(--twilight)]/50">
                      <CategoryIcon
                        type={event.category}
                        size={16}
                        glow="subtle"
                      />
                    </span>
                  )}
                  <EventCardBadges
                    isLive={isLive}
                    hasFestivalId={Boolean(event.festival_id)}
                    isTentpole={Boolean(event.is_tentpole)}
                    costTier={event.cost_tier}
                    size="mobile"
                  />
                </div>
                {/* Title row */}
                <h3 className="text-[var(--text-primary)] font-semibold text-base leading-tight line-clamp-2 group-hover:text-[var(--accent-color)] transition-colors mb-1.5">
                  {eventTitle}
                </h3>
              </div>

              {/* Desktop: Inline layout */}
              <div className="hidden sm:flex items-center gap-2.5 mb-1">
                {event.category && (
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-accent-20 border border-[var(--twilight)]/55">
                    <CategoryIcon
                      type={event.category}
                      size={16}
                      glow="subtle"
                    />
                  </span>
                )}
                <span className="text-[var(--text-primary)] font-semibold text-lg transition-colors line-clamp-1 group-hover:text-[var(--accent-color)] leading-tight">
                  {eventTitle}
                </span>
                <EventCardBadges
                  isLive={isLive}
                  hasFestivalId={Boolean(event.festival_id)}
                  isTentpole={Boolean(event.is_tentpole)}
                  costTier={event.cost_tier}
                  size="desktop"
                />
              </div>

              {/* Venue, price, series, class, instructor, skill level + reason badges */}
              <EventCardMetadata
                venueName={venueName}
                venueNeighborhood={venueNeighborhood}
                locationLabel={locationLabel}
                price={price}
                series={event.series ?? null}
                isClass={event.is_class}
                instructorName={instructorName}
                skillLevel={event.skill_level}
                reasons={reasons}
                contextType={contextType}
                portalSlug={portalSlug}
                hasFriendsGoing={friendsGoing.length > 0}
                duration={event.duration}
                bookingRequired={event.booking_required}
              />

              {/* Editorial press quote — shown when venue/event has been covered */}
              {editorialMentions && editorialMentions.length > 0 && (
                <div className="mt-1.5">
                  <PressQuote
                    snippet={editorialMentions[0].snippet}
                    source={editorialMentions[0].source_key
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase())}
                    articleUrl={editorialMentions[0].article_url}
                  />
                </div>
              )}

              {/* Social proof — friends going + aggregate counts */}
              <EventCardSocialProof
                friendsGoing={friendsGoing}
                hasSocialProof={hasSocialProof}
                goingCount={goingCount}
                interestedCount={interestedCount}
                recommendationCount={recommendationCount}
              />
            </div>
          </div>
        </Link>

        {/* Right-side action buttons */}
        <EventCardActions
          eventId={event.id}
          handleRSVPChange={handleRSVPChange}
          isExternalLinkOut={isExternalLinkOut}
          linkOutUrl={linkOutUrl}
          linkOutLabel={linkOutLabel}
          isTicketLinkOut={isTicketLinkOut}
        />
      </div>
    </div>
  );
}

export default memo(EventCard);

// ============================================
// VARIANT COMPONENTS - Shared card layouts for feed views
// ============================================

// Trending/fire icon SVG
const TrendingIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z" />
  </svg>
);

// Social proof badge for feed cards
function FeedSocialProofBadge({
  count,
  label = "going",
  variant = "default",
}: {
  count: number;
  label?: string;
  variant?: "default" | "compact";
}) {
  if (count < 1) return null;

  if (variant === "compact") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)]/20 font-mono text-xs font-medium text-[var(--coral)]">
        <svg
          className="w-2.5 h-2.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        {count} {label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)]/20 font-mono text-xs font-medium text-[var(--coral)]">
      <svg
        className="w-3 h-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
      {count} {label}
    </span>
  );
}

type EventMetadataOptions = {
  includeDate?: boolean;
  includeTime?: boolean;
  includeVenue?: boolean;
  includeNeighborhood?: boolean;
  includePrice?: boolean;
};

function getLocationDesignatorLabel(
  designator: LocationDesignator,
): string | null {
  if (!designator || designator === "standard") return null;
  if (designator === "private_after_signup") return "Location After RSVP";
  if (designator === "virtual") return "Virtual";
  if (designator === "recovery_meeting") return "Recovery Meeting";
  return null;
}

function getEventPriceLabel(event: FeedEventData): string | null {
  if (event.is_free) return "Free";
  if (
    event.price_min !== null &&
    event.price_max !== null &&
    event.price_max > event.price_min
  ) {
    return `$${event.price_min}-$${event.price_max}`;
  }
  if (event.price_min !== null) {
    return `From $${event.price_min}`;
  }
  return null;
}

function getUnifiedMetadata(
  event: FeedEventData,
  options: EventMetadataOptions = {},
): string[] {
  const {
    includeDate = true,
    includeTime = true,
    includeVenue = true,
    includeNeighborhood = true,
    includePrice = true,
  } = options;

  const parts: string[] = [];

  if (includeDate) {
    parts.push(getSmartDateLabel(event.start_date));
  }

  if (includeTime) {
    if (event.is_all_day) {
      parts.push("All Day");
    } else if (event.start_time) {
      parts.push(formatTime(event.start_time));
    }
  }

  if (includeVenue && event.venue?.name) {
    parts.push(event.venue.name);
  }

  if (includeNeighborhood && event.venue?.neighborhood) {
    parts.push(event.venue.neighborhood);
  }

  const locationLabel = getLocationDesignatorLabel(
    event.venue?.location_designator,
  );
  if (locationLabel) {
    parts.push(locationLabel);
  }

  if (includePrice) {
    const priceLabel = getEventPriceLabel(event);
    if (priceLabel) parts.push(priceLabel);
  }

  return parts;
}

// ============================================
// GridEventCard - For grid/carousel layouts (FeedSection EventCards)
// ============================================

interface GridEventCardProps {
  event: FeedEventData & { contextual_label?: string };
  isCarousel?: boolean;
  portalSlug?: string;
  vertical?: string | null;
}

export const GridEventCard = memo(function GridEventCard({
  event,
  isCarousel,
  portalSlug,
  vertical,
}: GridEventCardProps) {
  const goingCount = event.going_count || 0;
  const interestedCount = event.interested_count || 0;
  const recommendationCount = event.recommendation_count || 0;
  const isPopular = goingCount >= 10;
  const eventStatus = getFeedEventStatus(event.start_date, event.start_time);
  const gridMetadata = getUnifiedMetadata(event, {
    includeDate: true,
    includeTime: true,
    includeVenue: true,
    includeNeighborhood: true,
    includePrice: true,
  });

  return (
    <Link
      href={
        portalSlug
          ? (getCivicEventHref(event, portalSlug, vertical) ?? `/${portalSlug}?event=${event.id}`)
          : `/events/${event.id}`
      }
      data-category={event.category || "other"}
      data-accent="category"
      className={`group flex flex-col rounded-xl overflow-hidden border transition-all hover:border-[var(--coral)]/30 coral-glow-hover ${
        isCarousel ? "flex-shrink-0 w-72 snap-start" : ""
      } ${isPopular ? "border-[var(--coral)]/20 coral-glow" : "border-[var(--twilight)]"} bg-[var(--card-bg)]`}
    >
      {/* Content */}
      <div className="flex-1 p-3">
        {/* Popular badge + contextual label */}
        <div className="flex items-center gap-2 mb-1.5">
          {(event as FeedEventData & { contextual_label?: string }).contextual_label && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-mono font-medium text-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/25">
              {(event as FeedEventData & { contextual_label?: string }).contextual_label}
            </span>
          )}
          {isPopular && (
            <span className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[var(--coral)] text-[var(--void)] text-2xs font-mono font-medium">
              <TrendingIcon className="w-2.5 h-2.5" /> Popular
            </span>
          )}
        </div>

        {/* Title */}
        <h4 className="font-medium text-sm text-[var(--cream)] line-clamp-2 group-hover:text-[var(--coral)] transition-colors leading-snug">
          {event.title}
        </h4>

        {/* Metadata order: Date • Time • Venue • Neighborhood • Price */}
        {gridMetadata.length > 0 && (
          <p className="font-mono text-xs text-[var(--soft)] mt-1.5 truncate">
            {gridMetadata.join(" · ")}
          </p>
        )}

        {/* Status + Social badges */}
        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          <RSVPButton eventId={event.id} variant="compact" size="sm" />
          {eventStatus === "live" && <LiveBadge />}
          {eventStatus === "soon" && <SoonBadge />}
          {goingCount > 0 && (
            <FeedSocialProofBadge
              count={goingCount}
              label="going"
              variant="compact"
            />
          )}
          {interestedCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 font-mono text-xs font-medium text-[var(--gold)]">
              {interestedCount} maybe
            </span>
          )}
          {recommendationCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-[var(--lavender)]/15 border border-[var(--lavender)]/30 font-mono text-xs font-medium text-[var(--lavender)]">
              <svg
                className="w-2.5 h-2.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
              {recommendationCount} rec&apos;d
            </span>
          )}
        </div>
      </div>
    </Link>
  );
});

// ============================================
// CompactEventCard - For list layouts (FeedSection EventListItem)
// ============================================

interface CompactEventCardProps {
  event: FeedEventData;
  isAlternate?: boolean;
  showDate?: boolean;
  portalSlug?: string;
  vertical?: string | null;
}

export const CompactEventCard = memo(function CompactEventCard({
  event,
  isAlternate,
  showDate = true,
  portalSlug,
  vertical,
}: CompactEventCardProps) {
  const goingCount = event.going_count || 0;
  const interestedCount = event.interested_count || 0;
  const recommendationCount = event.recommendation_count || 0;
  const isPopular = goingCount >= 10;
  const isTrending = event.is_trending || false;
  const eventStatus = getFeedEventStatus(event.start_date, event.start_time);
  const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);
  const accentColor = event.category
    ? getCategoryColor(event.category)
    : "var(--neon-magenta)";
  const reflectionClass = getReflectionClass(event.category);
  const compactTimeLabel = event.is_all_day
    ? "All Day"
    : `${time}${period ? ` ${period}` : ""}`;
  const compactPrice = getEventPriceLabel(event);
  const compactPrimaryMetadataParts: Array<{
    key: string;
    value: string;
    className?: string;
  }> = [];
  const compactSecondaryMetadataParts: Array<{
    key: string;
    value: string;
    className?: string;
  }> = [];

  if (event.venue?.name) {
    compactPrimaryMetadataParts.push({ key: "venue", value: event.venue.name });
  }
  if (event.venue?.neighborhood) {
    compactPrimaryMetadataParts.push({
      key: "neighborhood",
      value: event.venue.neighborhood,
    });
  }
  const compactLocationLabel = getLocationDesignatorLabel(
    event.venue?.location_designator,
  );
  if (compactLocationLabel) {
    compactPrimaryMetadataParts.push({
      key: "location-designator",
      value: compactLocationLabel,
      className: "text-[var(--soft)]",
    });
  }
  if (showDate) {
    compactSecondaryMetadataParts.push({
      key: "date",
      value: getSmartDateLabel(event.start_date),
    });
  }
  if (compactPrice) {
    compactSecondaryMetadataParts.push({
      key: "price",
      value: compactPrice,
      className: event.is_free
        ? "text-[var(--neon-green)] font-medium"
        : undefined,
    });
  }
  if (goingCount > 0) {
    compactSecondaryMetadataParts.push({
      key: "going",
      value: `${formatCompactCount(goingCount)} going`,
      className: "text-[var(--coral)] font-medium",
    });
  }
  if (interestedCount > 0) {
    compactSecondaryMetadataParts.push({
      key: "interested",
      value: `${formatCompactCount(interestedCount)} maybe`,
      className: "text-[var(--gold)] font-medium",
    });
  }
  if (recommendationCount > 0) {
    compactSecondaryMetadataParts.push({
      key: "recommended",
      value: `${formatCompactCount(recommendationCount)} rec'd`,
      className: "text-[var(--lavender)] font-medium",
    });
  }
  const compactMobileMetadataParts =
    compactPrimaryMetadataParts.length > 0
      ? compactPrimaryMetadataParts
      : compactSecondaryMetadataParts.slice(0, 2);
  const compactDesktopMetadataParts = [
    ...compactPrimaryMetadataParts,
    ...compactSecondaryMetadataParts,
  ];

  const hierarchyClass = isTrending
    ? "card-trending"
    : isPopular
      ? "card-popular"
      : "";

  return (
    <div
      className={`find-row-card rounded-xl border border-[var(--twilight)]/75 ${reflectionClass} ${hierarchyClass} overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] ${
        event.category ? "border-l-[2px] border-l-[var(--accent-color)]" : ""
      }`}
      data-list-row="true"
      aria-label={`${event.title}, ${getSmartDateLabel(event.start_date)} ${event.is_all_day ? "all day" : `${compactTimeLabel}`}`}
      style={
        {
          "--accent-color": accentColor,
          "--cta-border":
            "color-mix(in srgb, var(--accent-color) 70%, transparent)",
          "--cta-glow":
            "color-mix(in srgb, var(--accent-color) 35%, transparent)",
          background: isAlternate
            ? "linear-gradient(180deg, color-mix(in srgb, var(--night) 80%, transparent), color-mix(in srgb, var(--dusk) 68%, transparent))"
            : "linear-gradient(180deg, color-mix(in srgb, var(--night) 84%, transparent), color-mix(in srgb, var(--dusk) 72%, transparent))",
        } as CSSProperties
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2.5 sm:px-3 py-2.5">
        <Link
          href={
            portalSlug
              ? (getCivicEventHref(event, portalSlug, vertical) ?? `/${portalSlug}/events/${event.id}`)
              : `/events/${event.id}`
          }
          scroll={false}
          data-row-primary-link="true"
          data-category={event.category || "other"}
          data-accent={event.category ? "category" : ""}
          className="min-w-0"
        >
          <div className="min-w-0 space-y-1.5 sm:space-y-1">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="flex-shrink-0 font-mono text-xs sm:text-xs font-semibold uppercase tracking-[0.1em] text-[var(--accent-color)] min-w-[68px] sm:min-w-[82px]">
                {compactTimeLabel}
              </span>
              {isPopular && (
                <span className="flex-shrink-0 text-[var(--coral)]">
                  <TrendingIcon className="w-3 h-3" />
                </span>
              )}
            </div>
            <h4 className="text-base sm:text-base font-medium leading-[1.2] line-clamp-2 sm:line-clamp-1 text-[var(--cream)] group-hover:text-[var(--accent-color)] transition-colors">
              {event.title}
            </h4>
          </div>

          <div className="mt-1 sm:hidden flex items-center gap-1.5 font-mono text-xs leading-[1.2] text-[var(--soft)] min-w-0">
            {compactMobileMetadataParts.map((part, idx) => (
              <Fragment key={`${event.id}-mobile-${part.key}`}>
                {idx > 0 && <Dot />}
                <span className={`truncate ${part.className ?? ""}`}>
                  {part.value}
                </span>
              </Fragment>
            ))}
          </div>
          <div className="mt-1 hidden sm:flex items-center gap-1.5 font-mono text-xs text-[var(--soft)] min-w-0">
            {compactDesktopMetadataParts.map((part, idx) => (
              <Fragment key={`${event.id}-desktop-${part.key}`}>
                {idx > 0 && <Dot />}
                <span className={`truncate ${part.className ?? ""}`}>
                  {part.value}
                </span>
              </Fragment>
            ))}
          </div>
        </Link>

        <div className="flex items-center gap-1.5">
          <div data-row-save-action="true">
            <RSVPButton
              eventId={event.id}
              variant="compact"
              className="list-save-trigger"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {eventStatus === "live" && <LiveBadge />}
            {eventStatus === "soon" && <SoonBadge />}
            {event.is_free && <FreeBadge />}
          </div>
          <svg
            className="w-4 h-4 text-[var(--muted)] opacity-70 group-hover:opacity-100 transition-opacity"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
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
    </div>
  );
});

// ============================================
// HeroEventCard - For hero banner (FeedSection HeroBanner)
// ============================================

interface HeroEventCardProps {
  event: FeedEventData;
  portalSlug: string;
  hideImages?: boolean;
  editorialBlurb?: string | null;
  vertical?: string | null;
}

export const HeroEventCard = memo(function HeroEventCard({
  event,
  portalSlug,
  hideImages,
  editorialBlurb,
  vertical,
}: HeroEventCardProps) {
  const goingCount = event.going_count || 0;
  const interestedCount = event.interested_count || 0;
  const recommendationCount = event.recommendation_count || 0;
  const heroMetadata = getUnifiedMetadata(event, {
    includeDate: true,
    includeTime: true,
    includeVenue: true,
    includeNeighborhood: true,
    includePrice: true,
  });

  const heroImageUrl = event.image_url || event.series?.image_url || event.venue?.image_url;
  const hasImage = !hideImages && heroImageUrl;
  const heroEventHref = getCivicEventHref(event, portalSlug, vertical) ?? `/${portalSlug}/events/${event.id}`;
  return (
    <Link
      href={heroEventHref}
      className="block relative rounded-2xl overflow-hidden group hero-featured coral-glow-hover"
      aria-label={`Featured event: ${event.title}`}
    >
      {/* Background - either image or gradient */}
      {hasImage ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--twilight)] to-[var(--void)]">
            <Image
              src={heroImageUrl!}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 800px"
              blurhash={event.blurhash}
              fallback={
                <div className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, var(--dusk) 0%, color-mix(in srgb, ${getCategoryColor(event.category)} 25%, var(--twilight)) 40%, color-mix(in srgb, ${getCategoryColor(event.category)} 15%, var(--void)) 100%)`,
                  }}
                />
              }
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/30" />
        </>
      ) : (
        <>
          {/* Category-colored mesh gradient fallback */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, var(--dusk) 0%, color-mix(in srgb, ${getCategoryColor(event.category)} 30%, var(--twilight)) 40%, color-mix(in srgb, ${getCategoryColor(event.category)} 18%, var(--void)) 100%)`,
            }}
          />
          {/* Subtle dot-grid texture to break up the flat gradient */}
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage: `radial-gradient(circle at center, color-mix(in srgb, ${getCategoryColor(event.category)} 10%, transparent) 1px, transparent 1px)`,
              backgroundSize: "24px 24px",
            }}
          />
          {/* Centered category icon */}
          <div className="absolute inset-0 flex items-center justify-center opacity-25">
            <CategoryIcon type={event.category || "other"} size={64} glow="subtle" weight="light" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        </>
      )}

      {/* Content */}
      <div className="relative p-6 pt-36 sm:pt-44">
        {/* Featured + Category badges — only show when editorially featured */}
        {(event.is_tentpole || event.featured_blurb) && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--gold)] text-[var(--void)] text-xs font-mono font-medium">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Featured
            </span>
          </div>
        )}

        {/* Title */}
        <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-2 group-hover:text-[var(--coral)] transition-colors leading-tight">
          {event.title}
        </h2>

        {/* Metadata order: Date • Time • Venue • Neighborhood • Price */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-white/92 font-mono">
          {heroMetadata.map((value, idx) => (
            <Fragment key={`${event.id}-hero-meta-${idx}`}>
              {idx > 0 && <Dot />}
              <span className={idx === 0 ? "font-medium" : ""}>{value}</span>
            </Fragment>
          ))}
        </div>

        {/* Editorial blurb */}
        {editorialBlurb && (
          <p className="mt-3 text-sm text-white/80 italic leading-relaxed max-w-xl">
            {editorialBlurb}
          </p>
        )}

        {/* Social Proof badges */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <RSVPButton eventId={event.id} variant="compact" size="sm" />
          {goingCount > 0 && (
            <FeedSocialProofBadge count={goingCount} label="going" />
          )}
          {interestedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 font-mono text-xs font-medium text-[var(--gold)]">
              {interestedCount} maybe
            </span>
          )}
          {recommendationCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--lavender)]/15 border border-[var(--lavender)]/30 font-mono text-xs font-medium text-[var(--lavender)]">
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
              {recommendationCount} rec&apos;d
            </span>
          )}
        </div>
      </div>
    </Link>
  );
});

// ============================================
// TrendingEventCard - For TrendingNow component
// ============================================

interface TrendingEventCardProps {
  event: FeedEventData;
  portalSlug?: string;
  vertical?: string | null;
}

export const TrendingEventCard = memo(function TrendingEventCard({
  event,
  portalSlug,
  vertical,
}: TrendingEventCardProps) {
  const reflectionClass = getReflectionClass(event.category);
  const goingCount = event.going_count || 0;
  const accentMode = event.category ? "category" : "trending";
  const trendingMetadata = getUnifiedMetadata(event, {
    includeDate: true,
    includeTime: true,
    includeVenue: true,
    includeNeighborhood: true,
    includePrice: true,
  });

  return (
    <Link
      href={
        portalSlug
          ? (getCivicEventHref(event, portalSlug, vertical) ?? `/${portalSlug}?event=${event.id}`)
          : `/events/${event.id}`
      }
      scroll={false}
      data-category={event.category || undefined}
      data-accent={accentMode}
      className={`flex-shrink-0 w-72 p-3 bg-[var(--dusk)] rounded-xl border border-[var(--twilight)] transition-all duration-200 group card-atmospheric card-trending snap-start hover:border-[var(--twilight)]/80 hover:bg-[var(--dusk)]/80 glow-accent reflection-accent will-change-border-bg ${reflectionClass}`}
    >
      <div className="flex items-start gap-3">
        {/* Trending indicator */}
        <div className="flex-shrink-0 w-10 flex flex-col items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-[var(--neon-magenta)]/20 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-[var(--neon-magenta)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-sans text-sm font-medium text-[var(--cream)] line-clamp-2 group-hover:text-[var(--neon-magenta)] transition-colors">
            {event.title}
          </h3>

          <div className="flex items-center gap-1.5 mt-1 text-[var(--soft)]">
            <CategoryIcon type={event.category || "other"} size={12} />
            <span className="font-mono text-xs truncate">
              {trendingMetadata.join(" · ")}
            </span>
          </div>

          {/* Trending stats */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <RSVPButton eventId={event.id} variant="compact" size="sm" />
            {goingCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)]/20 font-mono text-xs font-medium text-[var(--coral)]">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {goingCount} going
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 font-mono text-xs font-medium text-[var(--gold)]">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 23c-3.6 0-7-1.4-7-5 0-2.5 1.8-4.6 3.5-6.4.6-.6 1.1-1.2 1.5-1.8-1.5 3.2.5 4.7 1.5 3.2.8-1.2.5-3-.5-5C13 5 16 2 17 1c-.5 3 1 5 2.5 7.5C21 11 22 13 22 15c0 5-4.5 8-10 8z" />
              </svg>
              Hot
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
});
