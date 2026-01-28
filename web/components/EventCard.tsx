"use client";

import { useState, memo } from "react";
import Link from "next/link";
import type { Event } from "@/lib/supabase";
import { AvatarStack } from "./UserAvatar";
import { formatTimeSplit, formatSmartDate } from "@/lib/formats";
import CategoryIcon, { getCategoryColor } from "./CategoryIcon";
import LazyImage from "./LazyImage";
import SeriesBadge from "./SeriesBadge";
import ReasonBadge, { getTopReasons, type RecommendationReason } from "./ReasonBadge";
import EventCardMenu from "./EventCardMenu";
import type { Frequency, DayOfWeek } from "@/lib/recurrence";

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
  /** Show thumbnail image on mobile when event has an image */
  showThumbnail?: boolean;
  /** Context type for filtering redundant reason badges */
  contextType?: "interests" | "venue" | "producer" | "neighborhood";
  /** Callback when user hides the event */
  onHide?: () => void;
}

interface PriceDisplay {
  text: string;
  isEstimate: boolean;
  isFree: boolean;
}

function formatPrice(
  isFree: boolean,
  min: number | null,
  max: number | null,
  venueMin: number | null | undefined,
  venueMax: number | null | undefined,
  catMin: number | null | undefined,
  catMax: number | null | undefined
): PriceDisplay | null {
  // Check explicit free flag or $0 pricing
  if (isFree || (min === 0 && (max === 0 || max === null))) {
    return { text: "Free", isEstimate: false, isFree: true };
  }

  // Use explicit event pricing if available
  if (min !== null || max !== null) {
    let text: string;
    if (min !== null && max !== null && min === max) {
      text = `$${min}`;
    } else if (min !== null && max !== null) {
      text = `$${min}-${max}`;
    } else if (min !== null) {
      text = `$${min}+`;
    } else {
      text = `Up to $${max}`;
    }
    return { text, isEstimate: false, isFree: false };
  }

  // Fall back to venue typical pricing
  if (venueMin !== null && venueMin !== undefined) {
    if (venueMin === 0) {
      return { text: "Free", isEstimate: true, isFree: true };
    }
    const text = venueMax && venueMax !== venueMin
      ? `~$${venueMin}-${venueMax}`
      : `~$${venueMin}`;
    return { text, isEstimate: true, isFree: false };
  }

  // Fall back to category typical pricing
  if (catMin !== null && catMin !== undefined) {
    if (catMin === 0) {
      return { text: "Usually Free", isEstimate: true, isFree: true };
    }
    const text = catMax && catMax !== catMin
      ? `~$${catMin}-${catMax}`
      : `~$${catMin}`;
    return { text, isEstimate: true, isFree: false };
  }

  return null;
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

function EventCard({ event, index = 0, skipAnimation = false, portalSlug, friendsGoing = [], reasons, showThumbnail = false, contextType, onHide }: Props) {
  const [thumbnailError, setThumbnailError] = useState(false);
  const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);
  const dateInfo = formatSmartDate(event.start_date);
  const isLive = event.is_live || false;
  // Only apply stagger animation to first 10 initial items, not infinite scroll items
  const staggerClass = !skipAnimation && index < 10 ? `stagger-${index + 1}` : "";
  const animationClass = skipAnimation ? "" : "animate-card-emerge";
  const categoryColor = event.category ? getCategoryColor(event.category) : null;
  const reflectionClass = getReflectionClass(event.category);
  // Add live heat class for live events
  const liveHeatClass = isLive ? "card-live-heat" : "";
  // Show thumbnail on mobile if enabled and event has an image
  const hasThumbnail = showThumbnail && event.image_url && !thumbnailError;

  const price = formatPrice(
    event.is_free,
    event.price_min,
    event.price_max,
    event.venue?.typical_price_min,
    event.venue?.typical_price_max,
    event.category_data?.typical_price_min,
    event.category_data?.typical_price_max
  );

  // Use query param navigation for in-app detail views (preserves auth state)
  const eventHref = portalSlug ? `/${portalSlug}?event=${event.id}` : `/events/${event.id}`;

  return (
    <Link
      href={eventHref}
      scroll={false}
      className={`block p-3 mb-4 rounded-lg border border-[var(--twilight)] card-atmospheric ${reflectionClass} ${liveHeatClass} ${animationClass} ${staggerClass} group overflow-hidden`}
      style={{
        borderLeftWidth: categoryColor ? "3px" : undefined,
        borderLeftColor: categoryColor || undefined,
        backgroundColor: "var(--card-bg)",
        "--glow-color": categoryColor || "var(--neon-magenta)",
        "--reflection-color": categoryColor ? `color-mix(in srgb, ${categoryColor} 10%, transparent)` : undefined,
      } as React.CSSProperties}
    >
      <div className="flex gap-3">
        {/* Time cell - improved readability */}
        <div className="flex-shrink-0 w-14 flex flex-col items-center justify-center py-1">
          <span className={`font-mono text-[0.55rem] font-medium leading-none ${
            dateInfo.isHighlight ? "text-[var(--coral)]" : "text-[var(--muted)]"
          }`}>
            {dateInfo.label}
          </span>
          <span className="font-mono text-sm font-medium text-[var(--soft)] leading-none tabular-nums mt-0.5">
            {time}
          </span>
          {period && (
            <span className="font-mono text-[0.55rem] text-[var(--muted)] mt-0.5">{period}</span>
          )}
        </div>

        {/* Mobile thumbnail (left side) */}
        {hasThumbnail && (
          <LazyImage
            src={event.image_url!}
            alt=""
            fill
            sizes="64px"
            className="flex-shrink-0 w-16 h-16 rounded-lg sm:hidden border border-[var(--twilight)]"
            placeholderColor={categoryColor ? `${categoryColor}15` : "var(--night)"}
            onError={() => setThumbnailError(true)}
          />
        )}
        {/* Mobile fallback thumbnail when image fails - category-aware gradient */}
        {showThumbnail && event.image_url && thumbnailError && (
          <div
            className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden relative sm:hidden border border-[var(--twilight)] flex items-center justify-center"
            style={{
              background: categoryColor
                ? `linear-gradient(135deg, ${categoryColor}25, ${categoryColor}08)`
                : "linear-gradient(135deg, var(--twilight), var(--night))"
            }}
          >
            <CategoryIcon type={event.category || "community"} size={28} glow="intense" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Mobile: Stacked layout for more title space */}
          <div className="sm:hidden">
            {/* Top row: category + live badge + menu */}
            <div className="flex items-center gap-2 mb-1">
              {event.category && (
                <span
                  className="inline-flex items-center justify-center w-5 h-5 rounded"
                  style={{
                    backgroundColor: categoryColor ? `${categoryColor}20` : undefined,
                  }}
                >
                  <CategoryIcon type={event.category} size={12} glow="subtle" />
                </span>
              )}
              {isLive && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border bg-[var(--neon-red)]/15 border-[var(--neon-red)]/30">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--neon-red)] opacity-40" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--neon-red)]" />
                  </span>
                  <span className="font-mono text-[0.5rem] font-medium text-[var(--neon-red)] uppercase tracking-wide">Live</span>
                </span>
              )}
              <EventCardMenu eventId={event.id} onHide={onHide} className="ml-auto" />
            </div>
            {/* Title row: full width */}
            <h3 className="text-[var(--cream)] font-medium leading-snug line-clamp-2 group-hover:text-[var(--glow-color,var(--neon-magenta))] transition-colors">
              {event.title}
            </h3>
          </div>

          {/* Desktop: Inline layout */}
          <div className="hidden sm:flex items-center gap-2">
            {event.category && (
              <span
                className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded"
                style={{
                  backgroundColor: categoryColor ? `${categoryColor}20` : undefined,
                }}
              >
                <CategoryIcon type={event.category} size={14} glow="subtle" />
              </span>
            )}
            <span
              className="text-[var(--cream)] transition-colors line-clamp-1 group-hover:text-[var(--glow-color,var(--neon-magenta))]"
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
            <EventCardMenu eventId={event.id} onHide={onHide} className="ml-auto" />
          </div>

          {/* Friends going row - elevated above details for social proof */}
          {friendsGoing.length > 0 && (
            <div className="flex items-center gap-2 mt-1.5">
              {/* Neon avatar stack */}
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
              <span className="text-xs text-[var(--neon-cyan)] font-medium">
                {friendsGoing.length === 1 ? (
                  <>
                    {friendsGoing[0].user.display_name || friendsGoing[0].user.username}
                    {" "}{friendsGoing[0].status === "going" ? "is going" : "is interested"}
                  </>
                ) : (
                  <>
                    {friendsGoing.length} friends
                    {" "}{friendsGoing.some(f => f.status === "going") ? "are in" : "are interested"}
                  </>
                )}
              </span>
            </div>
          )}

          {/* Details row */}
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted)] mt-1">
            {event.venue && (
              <span className="truncate max-w-[40%]" title={event.venue.name}>{event.venue.name}</span>
            )}
            {event.venue?.neighborhood && (
              <>
                <span className="opacity-40">·</span>
                <span className="truncate" title={event.venue.neighborhood}>{event.venue.neighborhood}</span>
              </>
            )}
            {price && price.text && (
              <>
                <span className="opacity-40">·</span>
                {price.isFree ? (
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded border font-mono text-[0.55rem] font-medium ${
                    price.isEstimate
                      ? "bg-[var(--neon-green)]/15 text-[var(--neon-green)] border-[var(--neon-green)]/25 opacity-90"
                      : "bg-[var(--neon-green)]/20 text-[var(--neon-green)] border-[var(--neon-green)]/30"
                  }`}>
                    {price.text}
                  </span>
                ) : (
                  <span className={`${price.isEstimate ? "opacity-60" : "text-[var(--soft)]"}`}>
                    {price.text}
                  </span>
                )}
              </>
            )}
            {/* Series badge */}
            {event.series && (
              <>
                <span className="opacity-40">·</span>
                <SeriesBadge
                  seriesType={event.series.series_type}
                  frequency={event.series.frequency}
                  dayOfWeek={event.series.day_of_week}
                  compact
                />
              </>
            )}
          </div>

          {/* Recommendation reasons - filter redundant badges based on context */}
          {friendsGoing.length === 0 && reasons && reasons.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {getTopReasons(
                reasons.filter((r) => {
                  // Filter out redundant badges based on section context
                  if (contextType === "venue" && r.type === "followed_venue") return false;
                  if (contextType === "producer" && r.type === "followed_producer") return false;
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
        </div>

        {/* Desktop thumbnail (right side) */}
        {hasThumbnail && (
          <LazyImage
            src={event.image_url!}
            alt=""
            fill
            sizes="80px"
            className="hidden sm:block flex-shrink-0 w-20 h-14 rounded-lg border border-[var(--twilight)] ml-auto"
            placeholderColor={categoryColor ? `${categoryColor}15` : "var(--night)"}
            onError={() => setThumbnailError(true)}
          />
        )}
      </div>
    </Link>
  );
}

export default memo(EventCard);
