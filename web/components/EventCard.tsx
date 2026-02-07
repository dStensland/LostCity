"use client";

import { memo, useState, useCallback } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import type { Event } from "@/lib/supabase";
import { AvatarStack } from "./UserAvatar";
import { formatTimeSplit, formatSmartDate, formatPriceDetailed, formatCompactCount } from "@/lib/formats";
import CategoryIcon, { getCategoryColor } from "./CategoryIcon";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";

import SeriesBadge from "./SeriesBadge";
import ReasonBadge, { getTopReasons, type RecommendationReason } from "./ReasonBadge";
import { SubcategoryChip, getSubcategoryLabel, shouldShowSubcategory } from "./ActivityChip";
import type { Frequency, DayOfWeek } from "@/lib/recurrence";
import RSVPButton, { type RSVPStatus } from "./RSVPButton";
import AnimatedCount from "./AnimatedCount";

const POPULAR_THRESHOLD = 10;

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
    frequency?: Frequency;
    day_of_week?: DayOfWeek;
  } | null;
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

// Known ticketing platform domains
const TICKETING_DOMAINS = [
  "eventbrite.com",
  "ticketmaster.com",
  "axs.com",
  "dice.fm",
  "seetickets.us",
  "etix.com",
  "ticketweb.com",
  "showclix.com",
  "ticketfly.com",
  "universe.com",
  "resident-advisor.net",
  "songkick.com",
];

// Common reservation platforms
const RESERVATION_DOMAINS = [
  "resy.com",
  "opentable.com",
  "tock.com",
  "exploretock.com",
  "sevenrooms.com",
  "toasttab.com",
];

function isTicketingUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return TICKETING_DOMAINS.some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
}

function isReservationUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return RESERVATION_DOMAINS.some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
}

function getLinkOutLabel({
  url,
  hasTicketUrl,
  isExternal,
}: {
  url: string;
  hasTicketUrl: boolean;
  isExternal: boolean;
}): string {
  if (isReservationUrl(url)) return "Reserve";
  if (isTicketingUrl(url)) return "Tickets";
  if (!isExternal) return "Details";
  return hasTicketUrl ? "Tickets" : "Details";
}

function EventCard({ event, index = 0, skipAnimation = false, portalSlug, friendsGoing = [], reasons, contextType }: Props) {
  const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);
  const dateInfo = formatSmartDate(event.start_date);
  const isLive = event.is_live || false;
  // Only apply stagger animation to first 10 initial items, not infinite scroll items
  const staggerClass = !skipAnimation && index < 10 ? `stagger-${index + 1}` : "";
  const animationClass = skipAnimation ? "" : "animate-card-emerge";
  const accentColor = event.category ? getCategoryColor(event.category) : "var(--neon-magenta)";
  const reflectionClass = getReflectionClass(event.category);
  const price = formatPriceDetailed(event);
  const accentClass = createCssVarClass("--accent-color", accentColor, "accent");

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
  const isPopular = goingCount >= POPULAR_THRESHOLD;

  // Use query param navigation for in-app detail views (preserves auth state)
  const eventHref = portalSlug ? `/${portalSlug}?event=${event.id}` : `/events/${event.id}`;
  const linkOutUrl = event.ticket_url || event.source_url || eventHref;
  const isExternalLinkOut = Boolean(event.ticket_url || event.source_url);
  const linkOutLabel = getLinkOutLabel({
    url: linkOutUrl,
    hasTicketUrl: Boolean(event.ticket_url),
    isExternal: isExternalLinkOut,
  });
  const isTicketLinkOut = Boolean(event.ticket_url) || isTicketingUrl(event.source_url);

  return (
    <>
      <ScopedStyles css={accentClass?.css} />
      <div
        className={`mb-4 rounded-sm border border-[var(--twilight)] card-atmospheric glow-accent reflection-accent ${reflectionClass} ${animationClass} ${staggerClass} bg-[var(--card-bg)] overflow-hidden group ${accentClass?.className ?? ""} ${
          event.category ? "border-l-[3px] border-l-[var(--accent-color)]" : ""
        }`}
        style={
          {
            "--cta-border": "color-mix(in srgb, var(--accent-color) 70%, transparent)",
            "--cta-glow": "color-mix(in srgb, var(--accent-color) 35%, transparent)",
          } as CSSProperties
        }
      >
        <div className="flex gap-3">
          <Link
            href={eventHref}
            scroll={false}
            className="block flex-1 min-w-0 p-3"
          >
            <div className="flex gap-3">
            {/* Time cell - bolder typography for visual hierarchy */}
            <div className="flex-shrink-0 w-14 flex flex-col items-center justify-center py-1">
              <span className={`font-mono text-[0.65rem] font-semibold leading-none uppercase tracking-wide ${
                dateInfo.isHighlight ? "text-[var(--coral)]" : "text-[var(--muted)]"
              }`}>
                {dateInfo.label}
              </span>
              {event.is_all_day ? (
                <span className="font-mono text-[0.65rem] font-semibold text-[var(--soft)] leading-none mt-1 uppercase tracking-wide">
                  All Day
                </span>
              ) : (
                <>
                  <span className="font-mono text-base font-bold text-[var(--cream)] leading-none tabular-nums mt-1">
                    {time}
                  </span>
                  {period && (
                    <span className="font-mono text-[0.6rem] font-medium text-[var(--soft)] mt-0.5">{period}</span>
                  )}
                </>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Mobile: Stacked layout for more title space */}
              <div className="sm:hidden">
                {/* Top row: category + live badge + menu */}
                <div className="flex items-center gap-2 mb-1.5">
                  {event.category && (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-accent-20">
                      <CategoryIcon type={event.category} size={18} glow="subtle" />
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
                <h3 className="text-[var(--cream)] font-bold text-lg leading-tight line-clamp-2 group-hover:text-[var(--glow-color,var(--neon-magenta))] transition-colors mb-1">
                  {event.title}
                </h3>
              </div>

              {/* Desktop: Inline layout */}
              <div className="hidden sm:flex items-center gap-2 mb-0.5">
                {event.category && (
                  <span className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded bg-accent-20">
                    <CategoryIcon type={event.category} size={20} glow="subtle" />
                  </span>
                )}
                <span
                  className="text-[var(--cream)] font-bold text-lg transition-colors line-clamp-1 group-hover:text-[var(--glow-color,var(--neon-magenta))]"
                >
                  {event.title}
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
              <div className="flex items-center gap-1.5 text-sm text-[var(--soft)] mt-1">
                {event.venue && (
                  <span className="truncate max-w-[60%] sm:max-w-[40%] font-medium" title={event.venue.name}>{event.venue.name}</span>
                )}
                {/* Subcategory chip - desktop only for cleaner mobile */}
                {shouldShowSubcategory(event.subcategory, event.category) && (
                  <span className="hidden sm:contents">
                    <span className="opacity-40">·</span>
                    <SubcategoryChip
                      label={getSubcategoryLabel(event.subcategory!)!}
                      value={event.subcategory!}
                      portalSlug={portalSlug}
                    />
                  </span>
                )}
                {/* Neighborhood - desktop only for cleaner mobile */}
                {event.venue?.neighborhood && (
                  <span className="hidden sm:contents">
                    <span className="opacity-40">·</span>
                    <span className="truncate" title={event.venue.neighborhood}>{event.venue.neighborhood}</span>
                  </span>
                )}
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
                {event.instructor && (
                  <span className="hidden sm:contents">
                    <span className="opacity-40">·</span>
                    <span className="truncate text-[var(--muted)] text-xs" title={event.instructor}>
                      w/ {event.instructor}
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
                  {/* Friends going — coral pill matching "I'm in" state */}
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
                </div>
              )}
            </div>

            </div>
          </Link>

          <div className="flex items-start gap-2 pt-3 pr-3 pb-3 flex-shrink-0">
            <RSVPButton eventId={event.id} variant="compact" onRSVPChange={handleRSVPChange} />
            {isExternalLinkOut && (
              <a
                href={linkOutUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={linkOutLabel}
                className="w-11 h-11 inline-flex items-center justify-center rounded-xl border border-[var(--twilight)]/80 bg-[var(--dusk)]/70 text-[var(--muted)] backdrop-blur-[2px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] hover:text-[var(--cream)] hover:border-[var(--cta-border,rgba(255,107,122,0.7))] hover:shadow-[0_0_18px_var(--cta-glow,rgba(255,107,122,0.25))] transition-all"
              >
                {isTicketLinkOut ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7v7m0-7L10 14" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10v8a1 1 0 001 1h8" />
                  </svg>
                )}
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default memo(EventCard);
