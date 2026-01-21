"use client";

import { useState, memo } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Event } from "@/lib/supabase";
import { formatTimeSplit } from "@/lib/formats";
import CategoryIcon, { getCategoryColor } from "./CategoryIcon";
import LazyImage from "./LazyImage";

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
  /** Show thumbnail image on mobile when event has an image */
  showThumbnail?: boolean;
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

function EventCard({ event, index = 0, skipAnimation = false, portalSlug, friendsGoing = [], showThumbnail = false }: Props) {
  const [thumbnailError, setThumbnailError] = useState(false);
  const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);
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

  return (
    <Link
      href={portalSlug ? `/${portalSlug}/events/${event.id}` : `/events/${event.id}`}
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
        {/* Time cell */}
        <div className="flex-shrink-0 w-12 flex flex-col items-center justify-center">
          <span className="font-mono text-sm text-[var(--muted)] leading-none">
            {time}
          </span>
          {period && (
            <span className="font-mono text-[0.5rem] text-[var(--muted)] opacity-60">{period}</span>
          )}
        </div>

        {/* Mobile thumbnail */}
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
        {/* Fallback thumbnail when image fails */}
        {showThumbnail && event.image_url && thumbnailError && (
          <div
            className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden relative sm:hidden border border-[var(--twilight)] flex items-center justify-center"
            style={{ backgroundColor: categoryColor ? `${categoryColor}15` : "var(--night)" }}
          >
            {event.category ? (
              <CategoryIcon type={event.category} size={24} glow="subtle" />
            ) : (
              <svg className="w-6 h-6 text-[var(--muted)] opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2">
            {event.category && (
              <span className="flex-shrink-0">
                <CategoryIcon type={event.category} size={16} glow="subtle" />
              </span>
            )}
            <span
              className="text-[var(--cream)] transition-colors truncate group-hover:text-[var(--glow-color,var(--neon-magenta))]"
            >
              {event.title}
            </span>
            {isLive && (
              <span className="flex-shrink-0 relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--neon-red)] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--neon-red)] shadow-[0_0_6px_var(--neon-red)]" />
              </span>
            )}
          </div>

          {/* Details row */}
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted)] mt-1">
            {event.venue && (
              <span className="truncate max-w-[40%]">{event.venue.name}</span>
            )}
            {event.venue?.neighborhood && (
              <>
                <span className="opacity-40">·</span>
                <span className="truncate">{event.venue.neighborhood}</span>
              </>
            )}
            {price && (
              <>
                <span className="opacity-40">·</span>
                {price.isFree ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[var(--neon-green)]/15 text-[var(--neon-green)] text-[0.65rem] font-medium">
                    {price.text}
                  </span>
                ) : (
                  <span className={`${price.isEstimate ? "opacity-60" : "text-[var(--soft)]"}`}>
                    {price.text}
                  </span>
                )}
              </>
            )}
          </div>

          {/* Friends going row */}
          {friendsGoing.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              {/* Mini avatar stack */}
              <div className="flex -space-x-1.5">
                {friendsGoing.slice(0, 3).map((friend) => (
                  friend.user.avatar_url ? (
                    <Image
                      key={friend.user_id}
                      src={friend.user.avatar_url}
                      alt={friend.user.display_name || friend.user.username}
                      width={18}
                      height={18}
                      className="w-[18px] h-[18px] rounded-full border border-[var(--void)] object-cover"
                    />
                  ) : (
                    <div
                      key={friend.user_id}
                      className="w-[18px] h-[18px] rounded-full border border-[var(--void)] bg-[var(--coral)] flex items-center justify-center text-[0.5rem] font-bold text-[var(--void)]"
                    >
                      {(friend.user.display_name || friend.user.username)[0].toUpperCase()}
                    </div>
                  )
                ))}
              </div>
              <span className="text-[0.65rem] text-[var(--neon-cyan)]">
                {friendsGoing.length === 1 ? (
                  <>
                    <span className="font-medium">{friendsGoing[0].user.display_name || friendsGoing[0].user.username}</span>
                    {" "}{friendsGoing[0].status === "going" ? "is going" : "is interested"}
                  </>
                ) : (
                  <>
                    <span className="font-medium">{friendsGoing.length} friends</span>
                    {" "}{friendsGoing.some(f => f.status === "going") ? "going" : "interested"}
                  </>
                )}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export default memo(EventCard);
