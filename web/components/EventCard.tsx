import Link from "next/link";
import type { Event } from "@/lib/supabase";
import { formatTimeSplit, formatPriceDetailed, type PriceableEvent } from "@/lib/formats";
import CategoryIcon from "./CategoryIcon";
import SaveButton from "./SaveButton";

type EventWithPriceEstimate = Event & {
  venue?: Event["venue"] & {
    typical_price_min?: number | null;
    typical_price_max?: number | null;
  } | null;
  category_data?: {
    typical_price_min: number | null;
    typical_price_max: number | null;
  } | null;
  // Social proof counts (optional)
  going_count?: number;
  interested_count?: number;
  recommendation_count?: number;
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

  // Category color for left accent
  const categoryColor = event.category ? `var(--cat-${event.category === 'food_drink' ? 'food' : event.category})` : 'var(--twilight)';

  // Social proof
  const goingCount = event.going_count || 0;
  const recommendCount = event.recommendation_count || 0;
  const hasSocialProof = goingCount > 0 || recommendCount > 0;

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
          {/* Social proof */}
          {hasSocialProof && (
            <span className="font-mono text-xs text-[var(--soft)]">
              {goingCount > 0 && (
                <span className="text-[var(--lavender)]">{goingCount} going</span>
              )}
              {goingCount > 0 && recommendCount > 0 && (
                <span className="text-[var(--muted)]"> · </span>
              )}
              {recommendCount > 0 && (
                <span className="text-[var(--gold)]">{recommendCount} rec</span>
              )}
            </span>
          )}
          {/* Mobile: show price inline */}
          <span
            className={`sm:hidden font-mono text-xs font-medium ${isFree ? "text-[var(--cat-community)]" : "text-[var(--muted)]"} ${isEstimate ? "italic opacity-70" : ""}`}
            title={isEstimate ? "Estimated price range" : undefined}
          >
            {priceText}
          </span>
          {/* Mobile: save button */}
          <div className="sm:hidden ml-auto">
            <SaveButton eventId={event.id} size="sm" />
          </div>
        </div>
      </div>

      {/* Price + Action column - desktop only */}
      <div className="hidden sm:flex items-center gap-2">
        <div
          className={`font-mono text-sm font-medium text-right whitespace-nowrap ${isFree ? "text-[var(--cat-community)]" : "text-[var(--muted)]"} ${isEstimate ? "italic opacity-70" : ""}`}
          title={isEstimate ? "Estimated price range" : undefined}
        >
          {priceText}
        </div>
        {/* Save button */}
        <SaveButton eventId={event.id} size="sm" />
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
