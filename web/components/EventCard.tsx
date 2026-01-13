import Link from "next/link";
import type { Event } from "@/lib/supabase";
import type { EventWithLocation } from "@/lib/search";
import CategoryIcon from "./CategoryIcon";

function formatTime(time: string | null, isAllDay?: boolean): { time: string; period: string } {
  if (isAllDay) return { time: "All", period: "Day" };
  if (!time) return { time: "TBA", period: "" };

  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 || 12;
  return { time: `${hour12}:${minutes}`, period };
}

type EventWithPriceEstimate = Event & {
  venue?: Event["venue"] & {
    typical_price_min?: number | null;
    typical_price_max?: number | null;
  } | null;
  category_data?: {
    typical_price_min: number | null;
    typical_price_max: number | null;
  } | null;
};

function formatPrice(event: EventWithPriceEstimate): { text: string; isFree: boolean; isEstimate: boolean } {
  // Explicit free
  if (event.is_free) return { text: "Free", isFree: true, isEstimate: false };

  // Has explicit price
  if (event.price_min !== null) {
    if (event.price_min === event.price_max || event.price_max === null) {
      return { text: `$${event.price_min}`, isFree: false, isEstimate: false };
    }
    return { text: `$${event.price_min}–${event.price_max}`, isFree: false, isEstimate: false };
  }

  // Try venue typical price first (more specific)
  const venueMin = event.venue?.typical_price_min;
  const venueMax = event.venue?.typical_price_max;
  if (venueMin !== null && venueMin !== undefined) {
    if (venueMin === 0 && venueMax === 0) {
      return { text: "Free", isFree: true, isEstimate: true };
    }
    if (venueMin === venueMax || venueMax === null || venueMax === undefined) {
      return { text: `~$${venueMin}`, isFree: false, isEstimate: true };
    }
    return { text: `~$${venueMin}–${venueMax}`, isFree: false, isEstimate: true };
  }

  // Fall back to category typical price
  const catMin = event.category_data?.typical_price_min;
  const catMax = event.category_data?.typical_price_max;
  if (catMin !== null && catMin !== undefined) {
    if (catMin === 0 && catMax === 0) {
      return { text: "Free", isFree: true, isEstimate: true };
    }
    if (catMin === catMax || catMax === null || catMax === undefined) {
      return { text: `~$${catMin}`, isFree: false, isEstimate: true };
    }
    return { text: `~$${catMin}–${catMax}`, isFree: false, isEstimate: true };
  }

  return { text: "—", isFree: false, isEstimate: false };
}

interface Props {
  event: EventWithPriceEstimate;
  index?: number;
}

export default function EventCard({ event, index = 0 }: Props) {
  const { time, period } = formatTime(event.start_time, event.is_all_day);
  const { text: priceText, isFree, isEstimate } = formatPrice(event);
  const hasTickets = !!event.ticket_url;

  // Stagger animation class
  const staggerClass = index < 10 ? `stagger-${index + 1}` : "";

  // Category color for left accent
  const categoryColor = event.category ? `var(--cat-${event.category === 'food_drink' ? 'food' : event.category})` : 'var(--twilight)';

  return (
    <Link
      href={`/events/${event.id}`}
      className={`event-item animate-fade-in ${staggerClass} group`}
      style={{ borderLeftColor: categoryColor }}
    >
      {/* Time column */}
      <div className="font-mono text-sm font-medium text-[var(--coral)]">
        {time}
        {period && <span className="text-xs text-[var(--muted)] ml-0.5">{period}</span>}
      </div>

      {/* Content column */}
      <div className="min-w-0">
        <h3 className="font-semibold text-[var(--cream)] leading-snug line-clamp-2 group-hover:text-[var(--coral)] transition-colors">
          {event.title}
        </h3>
        {event.venue && (
          <p className="font-serif text-sm text-[var(--soft)] mt-0.5 truncate">
            {event.venue.name}
            {event.venue.neighborhood && (
              <span className="text-[var(--muted)]"> · {event.venue.neighborhood}</span>
            )}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-2">
          {event.category && (
            <CategoryIcon type={event.category} size={14} showLabel />
          )}
          {/* Mobile: show price inline */}
          <span
            className={`sm:hidden font-mono text-xs font-medium ${isFree ? "text-[var(--cat-community)]" : "text-[var(--muted)]"} ${isEstimate ? "italic opacity-70" : ""}`}
            title={isEstimate ? "Estimated price range" : undefined}
          >
            {priceText}
          </span>
        </div>
      </div>

      {/* Price + Action column - desktop only */}
      <div className="hidden sm:flex items-center gap-3">
        <div
          className={`font-mono text-sm font-medium text-right whitespace-nowrap ${isFree ? "text-[var(--cat-community)]" : "text-[var(--muted)]"} ${isEstimate ? "italic opacity-70" : ""}`}
          title={isEstimate ? "Estimated price range" : undefined}
        >
          {priceText}
        </div>
        {/* Arrow indicator */}
        <div className="w-5 h-5 flex items-center justify-center text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors">
          {hasTickets ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      </div>
    </Link>
  );
}
