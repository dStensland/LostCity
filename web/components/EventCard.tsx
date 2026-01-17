import Link from "next/link";
import type { Event } from "@/lib/supabase";
import { formatTimeSplit, formatPriceDetailed, type PriceableEvent } from "@/lib/formats";
import SaveButton from "./SaveButton";
import FriendsGoing from "./FriendsGoing";
import LiveIndicator from "./LiveIndicator";

type EventWithPriceEstimate = Event & {
  venue?: Event["venue"] & {
    typical_price_min?: number | null;
    typical_price_max?: number | null;
  } | null;
  category_data?: {
    typical_price_min: number | null;
    typical_price_max: number | null;
  } | null;
  // Social proof counts
  going_count?: number;
  interested_count?: number;
  recommendation_count?: number;
  attendee_count?: number;
  // Status indicators
  is_live?: boolean;
  is_featured?: boolean;
  is_trending?: boolean;
} & PriceableEvent;

interface Props {
  event: EventWithPriceEstimate;
  index?: number;
}

export default function EventCard({ event, index = 0 }: Props) {
  const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);
  const { text: priceText, isFree, isEstimate } = formatPriceDetailed(event);
  const hasTickets = !!event.ticket_url;

  // Stagger animation class
  const staggerClass = index < 10 ? `stagger-${index + 1}` : "";

  // Category color for badge
  const categoryColor = event.category ? `var(--cat-${event.category === 'food_drink' ? 'food' : event.category})` : 'var(--muted)';

  // Social proof
  const goingCount = event.going_count || 0;
  const attendeeCount = event.attendee_count || 0;
  const displayCount = attendeeCount || goingCount;

  // Status flags
  const isLive = event.is_live || false;
  const isFeatured = event.is_featured || false;
  const isTrending = event.is_trending || false;

  return (
    <Link
      href={`/events/${event.id}`}
      className={`card-interactive rounded-xl p-4 animate-fade-in ${staggerClass} group block`}
    >
      <div className="flex gap-4">
        {/* Time Column */}
        <div className="flex-shrink-0 w-16 text-center pt-1">
          <div className="text-lg font-semibold text-[var(--cream)] font-mono">
            {time}
          </div>
          {period && (
            <div className="text-xs text-[var(--muted)] font-mono uppercase">
              {period}
            </div>
          )}
          {/* Real-time live indicator */}
          <div className="mt-2">
            <LiveIndicator eventId={event.id} initialIsLive={isLive} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Badges Row */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {/* Category badge */}
            {event.category && (
              <span
                className="cat-tag text-[0.6rem] font-mono font-semibold uppercase tracking-wide px-2 py-0.5 rounded"
                style={{ color: categoryColor }}
              >
                {event.category.replace('_', ' ')}
              </span>
            )}
            {/* Featured badge */}
            {isFeatured && (
              <span className="badge-featured text-[0.6rem] font-mono font-medium px-2 py-0.5 rounded inline-flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Featured
              </span>
            )}
            {/* Trending badge */}
            {isTrending && (
              <span className="badge-trending text-[0.6rem] font-mono font-medium px-2 py-0.5 rounded inline-flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                </svg>
                Trending
              </span>
            )}
            {/* Free badge */}
            {isFree && (
              <span className="badge-free text-[0.6rem] font-mono font-medium px-2 py-0.5 rounded">
                Free
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-display text-lg font-semibold text-[var(--cream)] leading-snug line-clamp-2 group-hover:text-[var(--neon-magenta)] transition-colors">
            {event.title}
          </h3>

          {/* Venue & Location */}
          {event.venue && (
            <div className="flex items-center gap-2 mt-1.5 text-sm text-[var(--muted)]">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">{event.venue.name}</span>
              {event.venue.neighborhood && (
                <>
                  <span className="text-[var(--twilight)]">·</span>
                  <span className="text-[var(--muted)] opacity-70">{event.venue.neighborhood}</span>
                </>
              )}
            </div>
          )}

          {/* Price & Social Proof */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-3">
              {!isFree && (
                <span
                  className={`font-mono text-sm font-medium ${isEstimate ? "text-[var(--muted)] italic opacity-70" : "text-[var(--cream)]"}`}
                  title={isEstimate ? "Estimated price range" : undefined}
                >
                  {priceText}
                </span>
              )}
              {/* Friends going avatar stack (only shows if logged in with friends) */}
              <FriendsGoing eventId={event.id} />
              {/* Fallback to generic count if no friends component rendered */}
              {displayCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-[var(--muted)] friends-going-fallback">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {displayCount} interested
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <SaveButton eventId={event.id} size="sm" />
              {hasTickets && (
                <span className="text-[var(--muted)] group-hover:text-[var(--neon-magenta)] transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
