import Link from "next/link";
import type { Event } from "@/lib/supabase";
import type { EventWithLocation } from "@/lib/search";

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

  // Stagger animation class
  const staggerClass = index < 10 ? `stagger-${index + 1}` : "";

  return (
    <Link
      href={`/events/${event.id}`}
      className={`event-item animate-fade-in ${staggerClass}`}
    >
      {/* Time column */}
      <div className="font-mono text-sm font-medium text-[var(--coral)]">
        {time}
        {period && <span className="text-xs text-[var(--muted)] ml-0.5">{period}</span>}
      </div>

      {/* Content column */}
      <div className="min-w-0">
        <h3 className="font-semibold text-[var(--cream)] leading-snug line-clamp-2">
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
            <span className={`cat-tag ${event.category}`}>
              {event.category.replace("_", " ")}
            </span>
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

      {/* Price column - desktop only */}
      <div
        className={`hidden sm:block font-mono text-sm font-medium text-right whitespace-nowrap ${isFree ? "text-[var(--cat-community)]" : "text-[var(--muted)]"} ${isEstimate ? "italic opacity-70" : ""}`}
        title={isEstimate ? "Estimated price range" : undefined}
      >
        {priceText}
      </div>
    </Link>
  );
}
