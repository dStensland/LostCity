"use client";

import { memo } from "react";
import Link from "next/link";
import type { Event } from "@/lib/supabase";
import { AvatarStack } from "./UserAvatar";
import { formatTimeSplit, formatSmartDate, formatPriceDetailed } from "@/lib/formats";
import CategoryIcon, { getCategoryColor } from "./CategoryIcon";

import SeriesBadge from "./SeriesBadge";
import ReasonBadge, { getTopReasons, type RecommendationReason } from "./ReasonBadge";
import { SubcategoryChip, getSubcategoryLabel, shouldShowSubcategory } from "./ActivityChip";
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
  is_class?: boolean;
  class_category?: string | null;
  skill_level?: string | null;
  instructor?: string | null;
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

function EventCard({ event, index = 0, skipAnimation = false, portalSlug, friendsGoing = [], reasons, contextType, onHide }: Props) {
  const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);
  const dateInfo = formatSmartDate(event.start_date);
  const isLive = event.is_live || false;
  // Only apply stagger animation to first 10 initial items, not infinite scroll items
  const staggerClass = !skipAnimation && index < 10 ? `stagger-${index + 1}` : "";
  const animationClass = skipAnimation ? "" : "animate-card-emerge";
  const categoryColor = event.category ? getCategoryColor(event.category) : null;
  const reflectionClass = getReflectionClass(event.category);
  const price = formatPriceDetailed(event);

  // Use query param navigation for in-app detail views (preserves auth state)
  const eventHref = portalSlug ? `/${portalSlug}?event=${event.id}` : `/events/${event.id}`;

  return (
    <Link
      href={eventHref}
      scroll={false}
      className={`block p-3 mb-4 rounded-sm border border-[var(--twilight)] card-atmospheric ${reflectionClass} ${animationClass} ${staggerClass} group overflow-hidden`}
      style={{
        borderLeftWidth: categoryColor ? "3px" : undefined,
        borderLeftColor: categoryColor || undefined,
        backgroundColor: "var(--card-bg)",
        "--glow-color": categoryColor || "var(--neon-magenta)",
        "--reflection-color": categoryColor ? `color-mix(in srgb, ${categoryColor} 10%, transparent)` : undefined,
      } as React.CSSProperties}
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
                <span
                  className="inline-flex items-center justify-center w-7 h-7 rounded"
                  style={{
                    backgroundColor: categoryColor ? `${categoryColor}20` : undefined,
                  }}
                >
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
              <span
                className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded"
                style={{
                  backgroundColor: categoryColor ? `${categoryColor}20` : undefined,
                }}
              >
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
              <span className="text-xs text-[var(--coral)] font-medium">
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

          {/* Details row - venue and metadata with better hierarchy */}
          <div className="flex items-center gap-1.5 text-sm text-[var(--soft)] mt-1">
            {event.venue && (
              <span className="truncate max-w-[40%] font-medium" title={event.venue.name}>{event.venue.name}</span>
            )}
            {/* Subcategory chip - shows activity type when useful */}
            {shouldShowSubcategory(event.subcategory, event.category) && (
              <>
                <span className="opacity-40">·</span>
                <SubcategoryChip
                  label={getSubcategoryLabel(event.subcategory!)!}
                  value={event.subcategory!}
                  portalSlug={portalSlug}
                />
              </>
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
            {/* Class badge */}
            {event.is_class && (
              <>
                <span className="opacity-40">·</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[0.6rem] font-semibold bg-[var(--neon-blue,#60a5fa)]/15 text-[var(--neon-blue,#60a5fa)] border border-[var(--neon-blue,#60a5fa)]/25">
                  Class
                </span>
              </>
            )}
            {/* Instructor */}
            {event.instructor && (
              <>
                <span className="opacity-40">·</span>
                <span className="truncate text-[var(--muted)] text-xs" title={event.instructor}>
                  w/ {event.instructor}
                </span>
              </>
            )}
            {/* Skill level */}
            {event.skill_level && (
              <>
                <span className="opacity-40">·</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[0.55rem] text-[var(--muted)] bg-[var(--twilight)]/40 capitalize">
                  {event.skill_level}
                </span>
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
        </div>

      </div>
    </Link>
  );
}

export default memo(EventCard);
