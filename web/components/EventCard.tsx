"use client";

import { memo, useState, useCallback, useMemo } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import type { Event } from "@/lib/supabase";
import { AvatarStack } from "./UserAvatar";
import { decodeHtmlEntities, formatTimeSplit, formatSmartDate, formatPriceDetailed, formatCompactCount, formatTime } from "@/lib/formats";
import CategoryIcon, { getCategoryColor, getCategoryLabel, CATEGORY_CONFIG, type CategoryType } from "./CategoryIcon";
import { getReflectionClass, isTicketingUrl, getLinkOutLabel, getSmartDateLabel, getFeedEventStatus } from "@/lib/card-utils";
import { LiveBadge, SoonBadge, FreeBadge } from "./Badge";
import Image from "@/components/SmartImage";
import SeriesBadge from "./SeriesBadge";
import ReasonBadge, { getTopReasons, type RecommendationReason } from "./ReasonBadge";
import type { Frequency, DayOfWeek } from "@/lib/recurrence";
import RSVPButton, { type RSVPStatus } from "./RSVPButton";
import AnimatedCount from "./AnimatedCount";

type EventCardEvent = Event & {
  is_live?: boolean;
  venue?: Event["venue"] & {
    typical_price_min?: number | null;
    typical_price_max?: number | null;
  } | null;
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

export type FriendGoing = {
  user_id: string;
  status: "going" | "interested";
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
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
  image_url: string | null;
  blurhash?: string | null;
  description: string | null;
  featured_blurb?: string | null;
  going_count?: number;
  interested_count?: number;
  recommendation_count?: number;
  is_trending?: boolean;
  ticket_url?: string | null;
  source_url?: string | null;
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
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
    slug?: string | null;
    blurhash?: string | null;
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
}: Props) {
  const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);
  const dateInfo = formatSmartDate(event.start_date);
  const isLive = event.is_live || false;
  // Only apply stagger animation to first 10 initial items, not infinite scroll items
  const staggerClass = !skipAnimation && index < 10 ? `stagger-${index + 1}` : "";
  const animationClass = skipAnimation ? "" : "animate-card-emerge";
  const accentColor = event.category ? getCategoryColor(event.category) : "var(--neon-magenta)";
  const reflectionClass = getReflectionClass(event.category);
  const price = formatPriceDetailed(event);
  const eventTitle = decodeHtmlEntities(event.title);
  const venueName = event.venue?.name ? decodeHtmlEntities(event.venue.name) : null;
  const venueNeighborhood = event.venue?.neighborhood ? decodeHtmlEntities(event.venue.neighborhood) : null;
  const instructorName = event.instructor ? decodeHtmlEntities(event.instructor) : null;
  const railImageUrl = event.image_url ?? event.series?.image_url ?? undefined;
  const railBlurhash = event.blurhash || event.series?.blurhash || null;
  const hasRailImage = Boolean(railImageUrl);

  // Optimistic RSVP count adjustments — user's own RSVP immediately ticks the count
  const [countAdjust, setCountAdjust] = useState({ going: 0, interested: 0, recommendation: 0 });

  const handleRSVPChange = useCallback((newStatus: RSVPStatus, prevStatus: RSVPStatus) => {
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
  }, []);

  const goingCount = (event.going_count ?? 0) + countAdjust.going;
  const interestedCount = (event.interested_count ?? 0) + countAdjust.interested;
  const recommendationCount = (event.recommendation_count ?? 0) + countAdjust.recommendation;
  const hasSocialProof = goingCount > 0 || interestedCount > 0 || recommendationCount > 0;

  // Build detail href - use portal context to show detail modal
  const eventHref = useMemo(() => {
    if (!portalSlug) return `/events/${event.id}`;
    return `/${portalSlug}?event=${event.id}`;
  }, [portalSlug, event.id]);
  const linkOutUrl = event.ticket_url || event.source_url || eventHref;
  const isExternalLinkOut = Boolean(event.ticket_url || event.source_url);
  const linkOutLabel = getLinkOutLabel({
    url: linkOutUrl,
    hasTicketUrl: Boolean(event.ticket_url),
    isExternal: isExternalLinkOut,
  });
  const isTicketLinkOut = Boolean(event.ticket_url) || isTicketingUrl(event.source_url);
  const compactTimeLabel = event.is_all_day ? "All Day" : `${time}${period ? ` ${period}` : ""}`;
  const compactCategoryLabel = event.category ? getCategoryLabel(event.category as CategoryType) : null;

  if (density === "compact") {
    return (
      <div
        className={`find-row-card mb-2.5 rounded-xl border border-[var(--twilight)]/75 ${reflectionClass} ${animationClass} ${staggerClass} overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] ${
          event.category ? "border-l-[2px] border-l-[var(--accent-color)]" : ""
        }`}
        tabIndex={0}
        data-list-row="true"
        aria-label={`${eventTitle}, ${dateInfo.label} ${event.is_all_day ? "all day" : `${time} ${period || ""}`}`}
        style={
          {
            "--accent-color": accentColor,
            "--cta-border": "color-mix(in srgb, var(--accent-color) 70%, transparent)",
            "--cta-glow": "color-mix(in srgb, var(--accent-color) 35%, transparent)",
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--night) 84%, transparent), color-mix(in srgb, var(--dusk) 72%, transparent))",
          } as CSSProperties
        }
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5">
          <Link
            href={eventHref}
            scroll={false}
            data-row-primary-link="true"
            className="min-w-0"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex-shrink-0 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[var(--accent-color)] min-w-[76px] sm:min-w-[82px]">
                {compactTimeLabel}
              </span>
              <span className="truncate text-[0.94rem] sm:text-[0.98rem] font-medium text-[var(--cream)] group-hover:text-[var(--accent-color)] transition-colors">
                {eventTitle}
              </span>
              {compactCategoryLabel && (
                <span className="inline-block max-w-[84px] sm:max-w-[120px] truncate flex-shrink-0 font-mono text-[0.62rem] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
                  {compactCategoryLabel}
                </span>
              )}
            </div>
          </Link>

          <div className="flex items-center gap-1.5">
            <div data-row-save-action="true">
              <RSVPButton eventId={event.id} variant="compact" onRSVPChange={handleRSVPChange} className="list-save-trigger" />
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
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7v7m0-7L10 14" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10v8a1 1 0 001 1h8" />
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
      className={`find-row-card mb-3 sm:mb-4 rounded-2xl border border-[var(--twilight)]/75 ${reflectionClass} ${animationClass} ${staggerClass} overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] ${
        event.category ? "border-l-[2px] border-l-[var(--accent-color)]" : ""
      }`}
      tabIndex={0}
      data-list-row="true"
      aria-label={`${eventTitle}, ${dateInfo.label} ${event.is_all_day ? "all day" : `${time} ${period || ""}`}`}
      style={
        {
          "--accent-color": accentColor,
          "--cta-border": "color-mix(in srgb, var(--accent-color) 70%, transparent)",
          "--cta-glow": "color-mix(in srgb, var(--accent-color) 35%, transparent)",
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--night) 84%, transparent), color-mix(in srgb, var(--dusk) 72%, transparent))",
        } as CSSProperties
      }
    >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:gap-3">
          <Link
            href={eventHref}
            scroll={false}
            data-row-primary-link="true"
            className="block min-w-0 p-3.5 sm:p-4"
          >
            <div className="flex gap-3 sm:gap-4">
            {/* Time cell - hidden on mobile (inlined instead), visible on desktop */}
            <div
              className={`hidden sm:flex flex-shrink-0 self-stretch relative w-[124px] -ml-3.5 sm:-ml-4 -my-3.5 sm:-my-4 overflow-hidden border-r border-[var(--twilight)]/60 ${
                hasRailImage ? "list-rail-media" : "bg-[var(--night)]/44"
              }`}
              style={{ borderTopLeftRadius: "inherit", borderBottomLeftRadius: "inherit" }}
            >
              {railImageUrl && (
                <>
                  <Image
                    src={railImageUrl}
                    alt={eventTitle}
                    fill
                    blurhash={railBlurhash}
                    sizes="124px"
                    className="object-cover scale-[1.03] transform-gpu will-change-transform"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/56 to-black/20 pointer-events-none" />
                </>
              )}
              <div className="relative z-10 flex h-full flex-col items-start justify-center gap-1.5 pl-3 pr-2 py-3 sm:py-4">
                <span className={`font-mono text-[0.62rem] font-semibold leading-none uppercase tracking-[0.12em] ${
                  dateInfo.isHighlight ? "text-[var(--accent-color)]" : hasRailImage ? "text-[var(--cream)]/85" : "text-[var(--muted)]"
                }`}>
                  {dateInfo.label}
                </span>
                {event.is_all_day ? (
                  <span className={`font-mono text-[0.62rem] font-semibold leading-none uppercase tracking-[0.12em] ${hasRailImage ? "text-white/82" : "text-[var(--soft)]"}`}>
                    All Day
                  </span>
                ) : (
                  <>
                    <span className={`font-mono text-[1.42rem] font-bold leading-none tabular-nums ${hasRailImage ? "text-white" : "text-[var(--cream)]"}`}>
                      {time}
                    </span>
                    {period && (
                      <span className={`font-mono text-[0.58rem] font-medium uppercase tracking-[0.12em] ${hasRailImage ? "text-white/78" : "text-[var(--soft)]"}`}>{period}</span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Mobile: Stacked layout for more title space */}
              <div className="sm:hidden">
                {/* Top row: inline time + category + live badge */}
                <div className="flex items-center gap-2 mb-2">
                  {/* Inline time badge — replaces the hidden time column on mobile */}
                  <span className={`inline-flex items-baseline gap-1 font-mono text-[0.98rem] font-bold leading-none ${
                    dateInfo.isHighlight ? "text-[var(--accent-color)]" : "text-[var(--cream)]"
                  }`}>
                    {event.is_all_day ? (
                      <span className="text-[0.62rem] font-semibold text-[var(--soft)] uppercase tracking-[0.12em]">All Day</span>
                    ) : (
                      <>
                        {time}
                        {period && <span className="text-[0.58rem] font-medium text-[var(--soft)] uppercase tracking-[0.1em]">{period}</span>}
                      </>
                    )}
                  </span>
                  {event.category && (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-accent-20 border border-[var(--twilight)]/50">
                      <CategoryIcon type={event.category} size={16} glow="subtle" />
                    </span>
                  )}
                  {isLive && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-[var(--neon-red)]/15 border-[var(--neon-red)]/30">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--neon-red)] opacity-40" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--neon-red)]" />
                      </span>
                      <span className="font-mono text-[0.55rem] font-medium text-[var(--neon-red)] uppercase tracking-wide">Live</span>
                    </span>
                  )}
                </div>
                {/* Title row: full width - larger and bolder */}
                <h3 className="text-[var(--text-primary)] font-semibold text-[1.03rem] leading-tight line-clamp-2 group-hover:text-[var(--accent-color)] transition-colors mb-1.5">
                  {eventTitle}
                </h3>
              </div>

              {/* Desktop: Inline layout */}
              <div className="hidden sm:flex items-center gap-2.5 mb-1">
                {event.category && (
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-accent-20 border border-[var(--twilight)]/55">
                    <CategoryIcon type={event.category} size={18} glow="subtle" />
                  </span>
                )}
                <span
                  className="text-[var(--text-primary)] font-semibold text-[1.3rem] transition-colors line-clamp-1 group-hover:text-[var(--accent-color)] leading-tight"
                >
                  {eventTitle}
                </span>
                {isLive && (
                  <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-[var(--neon-red)]/15 border-[var(--neon-red)]/30">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--neon-red)] opacity-40" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--neon-red)]" />
                    </span>
                    <span className="font-mono text-[0.55rem] font-medium text-[var(--neon-red)] uppercase tracking-wide">Live</span>
                  </span>
                )}
              </div>

              {/* Details row - venue and metadata with better hierarchy */}
              {/* Mobile: show only venue + price; Desktop: show all metadata */}
              <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed flex-wrap">
                {venueName && (
                  <>
                    <span className="truncate max-w-[70%] sm:max-w-[45%] font-medium text-[var(--text-base)]" title={venueName}>{venueName}</span>
                    {venueNeighborhood && (
                      <>
                        <span className="opacity-40">·</span>
                        <span className="truncate text-[var(--text-tertiary)]" title={venueNeighborhood}>{venueNeighborhood}</span>
                      </>
                    )}
                  </>
                )}
                {/* Genre or subcategory chips - desktop only for cleaner mobile */}
                {price && price.text && (
                  <>
                    <span className="opacity-40">·</span>
                    {price.isFree ? (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-mono text-[0.65rem] font-semibold ${
                        price.isEstimate
                          ? "bg-[var(--neon-green)]/15 text-[var(--neon-green)] border border-[var(--neon-green)]/25"
                          : "bg-[var(--neon-green)]/25 text-[var(--neon-green)] border border-[var(--neon-green)]/40 shadow-[0_0_8px_var(--neon-green)/15]"
                      }`}>
                        {price.text}
                      </span>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-mono text-[0.65rem] font-medium ${
                        price.isEstimate
                          ? "bg-[var(--twilight)]/50 text-[var(--muted)]"
                          : "bg-[var(--twilight)] text-[var(--cream)] border border-[var(--twilight)]"
                      }`}>
                        {price.text}
                      </span>
                    )}
                  </>
                )}
                {/* Series badge - desktop only */}
                {event.series && (
                  <span className="hidden sm:contents">
                    <span className="opacity-40">·</span>
                    <SeriesBadge
                      seriesType={event.series.series_type}
                      frequency={event.series.frequency}
                      dayOfWeek={event.series.day_of_week}
                      compact
                    />
                  </span>
                )}
                {/* Class badge - desktop only */}
                {event.is_class && (
                  <span className="hidden sm:contents">
                    <span className="opacity-40">·</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[0.6rem] font-semibold bg-[var(--neon-blue,#60a5fa)]/15 text-[var(--neon-blue,#60a5fa)] border border-[var(--neon-blue,#60a5fa)]/25">
                      Class
                    </span>
                  </span>
                )}
                {/* Instructor - desktop only */}
                {instructorName && (
                  <span className="hidden sm:contents">
                    <span className="opacity-40">·</span>
                    <span className="truncate text-[var(--muted)] text-xs" title={instructorName}>
                      w/ {instructorName}
                    </span>
                  </span>
                )}
                {/* Skill level - desktop only */}
                {event.skill_level && (
                  <span className="hidden sm:contents">
                    <span className="opacity-40">·</span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[0.55rem] text-[var(--muted)] bg-[var(--twilight)]/40 capitalize">
                      {event.skill_level}
                    </span>
                  </span>
                )}
              </div>

              {/* Recommendation reasons - filter redundant badges based on context */}
              {friendsGoing.length === 0 && reasons && reasons.length > 0 && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {getTopReasons(
                    reasons.filter((r) => {
                      // Filter out redundant badges based on section context
                      if (contextType === "venue" && r.type === "followed_venue") return false;
                      if (contextType === "producer" && r.type === "followed_organization") return false;
                      if (contextType === "interests" && r.type === "category") return false;
                      if (contextType === "neighborhood" && r.type === "neighborhood") return false;
                      return true;
                    }),
                    2
                  ).map((reason, idx) => (
                    <ReasonBadge key={`${reason.type}-${idx}`} reason={reason} size="sm" />
                  ))}
                </div>
              )}

              {/* Social proof row — uses RSVP-button visual language (solid pill, mono, glow) */}
              {(friendsGoing.length > 0 || hasSocialProof) && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {/* Friends going — coral pill matching "I'm in" state (shown on all sizes) */}
                  {friendsGoing.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-lg bg-[var(--coral)]/15 border border-[var(--coral)]/30 shadow-[0_0_8px_var(--coral)/10]">
                      <AvatarStack
                        users={friendsGoing.map((f) => ({
                          id: f.user_id,
                          name: f.user.display_name || f.user.username,
                          avatar_url: f.user.avatar_url,
                        }))}
                        max={3}
                        size="xs"
                        showCount={friendsGoing.length > 3}
                      />
                      <span className="font-mono text-xs font-medium text-[var(--coral)]">
                        {friendsGoing.length === 1 ? (
                          <>
                            {friendsGoing[0].user.display_name || friendsGoing[0].user.username}
                            {" "}{friendsGoing[0].status === "going" ? "is in" : "is interested"}
                          </>
                        ) : (
                          <>
                            {friendsGoing.length} friends {friendsGoing.some(f => f.status === "going") ? "are in" : "interested"}
                          </>
                        )}
                      </span>
                    </span>
                  )}

                  {/* Mobile: collapsed social proof — single summary pill */}
                  {hasSocialProof && (() => {
                    const counts = [
                      { type: "going" as const, count: goingCount, label: "going", color: "coral" },
                      { type: "interested" as const, count: interestedCount, label: "maybe", color: "gold" },
                      { type: "recommended" as const, count: recommendationCount, label: "rec'd", color: "lavender" },
                    ];
                    const dominant = counts.reduce((a, b) => (b.count > a.count ? b : a));
                    const totalCount = goingCount + interestedCount + recommendationCount;
                    if (totalCount <= 0) return null;
                    return (
                      <span className={`sm:hidden inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-mono text-xs font-medium ${
                        dominant.color === "coral"
                          ? "bg-[var(--coral)]/10 border border-[var(--coral)]/20 text-[var(--coral)]"
                          : dominant.color === "gold"
                            ? "bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)]"
                            : "bg-[var(--lavender)]/15 border border-[var(--lavender)]/30 text-[var(--lavender)]"
                      }`}>
                        {dominant.type === "going" && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {dominant.type === "recommended" && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        )}
                        {formatCompactCount(totalCount)} {dominant.label}
                      </span>
                    );
                  })()}

                  {/* Desktop: separate pills */}
                  <span className="hidden sm:contents">
                    {/* Going count — coral pill */}
                    {goingCount > 0 && (friendsGoing.length === 0 || goingCount > friendsGoing.length) && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)]/20 font-mono text-xs font-medium text-[var(--coral)]">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <AnimatedCount value={goingCount} format={formatCompactCount} /> going
                      </span>
                    )}

                    {/* Interested count — gold pill matching "Maybe" state */}
                    {interestedCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 font-mono text-xs font-medium text-[var(--gold)]">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                        </svg>
                        <AnimatedCount value={interestedCount} format={formatCompactCount} /> maybe
                      </span>
                    )}

                    {/* Recommendations — lavender pill */}
                    {recommendationCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--lavender)]/15 border border-[var(--lavender)]/30 font-mono text-xs font-medium text-[var(--lavender)]">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                        <AnimatedCount value={recommendationCount} format={formatCompactCount} /> rec&apos;d
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>

            </div>
          </Link>

          <div className="flex flex-col items-end gap-2 pt-3 pr-3 pb-3 sm:pt-4 sm:pr-4 sm:pb-4 flex-shrink-0">
            <div className="flex items-start gap-1.5 sm:gap-2">
              <div data-row-save-action="true">
                <RSVPButton eventId={event.id} variant="compact" onRSVPChange={handleRSVPChange} className="list-save-trigger" />
              </div>
              {isExternalLinkOut && (
                <a
                  href={linkOutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={linkOutLabel}
                  data-row-open-action="true"
                  style={{ touchAction: "manipulation" }}
                  className="hidden sm:inline-flex w-10 h-10 items-center justify-center rounded-xl border border-[var(--twilight)]/75 bg-[var(--dusk)]/72 text-[var(--muted)] backdrop-blur-[2px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] hover:text-[var(--cream)] hover:border-[var(--cta-border,rgba(255,107,122,0.7))] hover:shadow-[0_0_18px_var(--cta-glow,rgba(255,107,122,0.25))] transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
                >
                  {isTicketLinkOut ? (
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                  ) : (
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7v7m0-7L10 14" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10v8a1 1 0 001 1h8" />
                    </svg>
                  )}
                </a>
              )}
            </div>
          </div>
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
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)]/20 font-mono text-[0.6rem] font-medium text-[var(--coral)]">
        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        {count} {label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)]/20 font-mono text-xs font-medium text-[var(--coral)]">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      {count} {label}
    </span>
  );
}

// ============================================
// GridEventCard - For grid/carousel layouts (FeedSection EventCards)
// ============================================

interface GridEventCardProps {
  event: FeedEventData;
  isCarousel?: boolean;
  portalSlug?: string;
}

export const GridEventCard = memo(function GridEventCard({ event, isCarousel, portalSlug }: GridEventCardProps) {
  const goingCount = event.going_count || 0;
  const interestedCount = event.interested_count || 0;
  const recommendationCount = event.recommendation_count || 0;
  const isPopular = goingCount >= 10;
  const eventStatus = getFeedEventStatus(event.start_date, event.start_time);

  return (
    <Link
      href={portalSlug ? `/${portalSlug}?event=${event.id}` : `/events/${event.id}`}
      data-category={event.category || "other"}
      data-accent="category"
      className={`group flex flex-col rounded-xl overflow-hidden border transition-all hover:border-[var(--coral)]/30 coral-glow-hover ${
        isCarousel ? "flex-shrink-0 w-72 snap-start" : ""
      } ${isPopular ? "border-[var(--coral)]/20 coral-glow" : "border-[var(--twilight)]"} bg-[var(--card-bg)]`}
    >
      {/* Content */}
      <div className="flex-1 p-3">
        {/* Category + Smart Date + Popular */}
        <div className="flex items-center gap-2 mb-1.5">
          {event.category && (
            <CategoryIcon type={event.category} size={12} />
          )}
          <span className="font-mono text-[0.65rem] text-[var(--muted)]">
            {getSmartDateLabel(event.start_date)}
            {event.start_time && ` · ${formatTime(event.start_time)}`}
          </span>
          {isPopular && (
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
          {eventStatus === "live" && <LiveBadge />}
          {eventStatus === "soon" && <SoonBadge />}
          {event.is_free ? (
            <FreeBadge />
          ) : event.price_min !== null ? (
            <span className="text-[0.6rem] font-mono text-[var(--muted)]">
              From ${event.price_min}
            </span>
          ) : null}
          {goingCount > 0 && (
            <FeedSocialProofBadge count={goingCount} label="going" variant="compact" />
          )}
          {interestedCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 font-mono text-[0.6rem] font-medium text-[var(--gold)]">
              {interestedCount} maybe
            </span>
          )}
          {recommendationCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-[var(--lavender)]/15 border border-[var(--lavender)]/30 font-mono text-[0.6rem] font-medium text-[var(--lavender)]">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
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
}

export const CompactEventCard = memo(function CompactEventCard({ event, isAlternate, showDate = true, portalSlug }: CompactEventCardProps) {
  const goingCount = event.going_count || 0;
  const interestedCount = event.interested_count || 0;
  const recommendationCount = event.recommendation_count || 0;
  const isPopular = goingCount >= 10;
  const isTrending = event.is_trending || false;
  const eventStatus = getFeedEventStatus(event.start_date, event.start_time);

  const hierarchyClass = isTrending ? "card-trending" : isPopular ? "card-popular" : "";

  return (
    <Link
      href={portalSlug ? `/${portalSlug}?event=${event.id}` : `/events/${event.id}`}
      data-category={event.category || "other"}
      data-accent={event.category ? "category" : ""}
      className={`flex items-center gap-3 px-3 py-3 rounded-lg border transition-all group card-atmospheric glow-accent reflection-accent ${hierarchyClass} hover:border-[var(--coral)]/30 ${
        isPopular || isTrending
          ? "border-[var(--coral)]/20"
          : isAlternate
            ? "border-transparent"
            : "border-[var(--twilight)]"
      } ${isPopular ? "bg-[var(--coral-bg)]" : "bg-[var(--card-bg)]"} ${
        event.category ? "border-l-[3px] border-l-[var(--accent-color)]" : ""
      }`}
    >
      {/* Smart Time */}
      <div className="flex-shrink-0 w-16 font-mono text-sm text-[var(--soft)] text-center">
        <div className="font-medium">{event.start_time ? formatTime(event.start_time) : "All day"}</div>
      </div>

      {/* Category icon */}
      {event.category && (
        <CategoryIcon type={event.category} size={16} className="flex-shrink-0 opacity-60" />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-[var(--cream)] truncate transition-all group-hover:text-glow">
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
              <span>{getSmartDateLabel(event.start_date)}</span>
              {event.venue && <span className="opacity-40">·</span>}
            </>
          )}
          {event.venue && (
            <span className="truncate">{event.venue.name}</span>
          )}
          {goingCount > 0 && (
            <>
              <span className="opacity-40">·</span>
              <span className="text-[var(--coral)] font-medium">{goingCount} going</span>
            </>
          )}
          {interestedCount > 0 && (
            <>
              <span className="opacity-40">·</span>
              <span className="text-[var(--gold)] font-medium">{interestedCount} maybe</span>
            </>
          )}
          {recommendationCount > 0 && (
            <>
              <span className="opacity-40">·</span>
              <span className="text-[var(--lavender)] font-medium">{recommendationCount} rec&apos;d</span>
            </>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {eventStatus === "live" && <LiveBadge />}
        {eventStatus === "soon" && <SoonBadge />}
        {event.is_free && <FreeBadge />}
        <svg className="w-4 h-4 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
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
}

export const HeroEventCard = memo(function HeroEventCard({ event, portalSlug, hideImages, editorialBlurb }: HeroEventCardProps) {
  const goingCount = event.going_count || 0;
  const interestedCount = event.interested_count || 0;
  const recommendationCount = event.recommendation_count || 0;

  const hasImage = !hideImages && event.image_url;
  return (
    <Link
      href={`/${portalSlug}?event=${event.id}`}
      className="block relative rounded-2xl overflow-hidden group hero-featured coral-glow-hover"
      aria-label={`Featured event: ${event.title}`}
    >
      {/* Background - either image or gradient */}
      {hasImage ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--twilight)] to-[var(--void)]">
            <Image
              src={event.image_url!}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 800px"
              blurhash={event.blurhash}
            />
          </div>
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
              data-category={event.category}
              data-accent="category"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-accent text-[var(--void)]"
            >
              <CategoryIcon type={event.category} size={12} className="!text-[var(--void)]" glow="none" />
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
          <span className="font-medium">{getSmartDateLabel(event.start_date)}</span>
          {event.start_time && (
            <>
              <span className="opacity-40">·</span>
              <span>{formatTime(event.start_time)}</span>
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
        {editorialBlurb && (
          <p className="mt-3 text-sm text-white/80 italic leading-relaxed max-w-xl">
            {editorialBlurb}
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
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
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
}

export const TrendingEventCard = memo(function TrendingEventCard({ event, portalSlug }: TrendingEventCardProps) {
  const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);
  const reflectionClass = getReflectionClass(event.category);
  const smartDate = getSmartDateLabel(event.start_date);
  const goingCount = event.going_count || 0;
  const accentMode = event.category ? "category" : "trending";

  return (
    <Link
      href={portalSlug ? `/${portalSlug}?event=${event.id}` : `/events/${event.id}`}
      scroll={false}
      data-category={event.category || undefined}
      data-accent={accentMode}
      className={`flex-shrink-0 w-72 p-3 bg-[var(--dusk)] rounded-xl border border-[var(--twilight)] transition-all duration-200 group card-atmospheric card-trending snap-start hover:border-[var(--twilight)]/80 hover:bg-[var(--dusk)]/80 glow-accent reflection-accent will-change-border-bg ${reflectionClass}`}
    >
      <div className="flex items-start gap-3">
        {/* Trending indicator */}
        <div className="flex-shrink-0 w-10 flex flex-col items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-[var(--neon-magenta)]/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-[var(--neon-magenta)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-sans text-sm font-medium text-[var(--cream)] line-clamp-2 group-hover:text-[var(--neon-magenta)] transition-colors">
            {event.title}
          </h3>

          <div className="flex items-center gap-1.5 mt-1 text-[var(--muted)]">
            <CategoryIcon type={event.category || "other"} size={12} />
            <span className="font-mono text-[0.6rem]">
              {smartDate} · {time}
              {period && <span className="opacity-60">{period}</span>}
            </span>
          </div>

          {event.venue?.name && (
            <p className="font-mono text-[0.6rem] text-[var(--muted)] truncate mt-0.5">
              {event.venue.name}
            </p>
          )}

          {/* Trending stats */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {goingCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)]/20 font-mono text-[0.6rem] font-medium text-[var(--coral)]">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {goingCount} going
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 font-mono text-[0.6rem] font-medium text-[var(--gold)]">
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
