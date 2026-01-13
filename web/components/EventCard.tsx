import Link from "next/link";
import type { Event } from "@/lib/supabase";

function formatTime(time: string | null, isAllDay?: boolean): { time: string; period: string } {
  if (isAllDay) return { time: "All", period: "Day" };
  if (!time) return { time: "TBA", period: "" };

  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const period = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 || 12;
  return { time: `${hour12}:${minutes}`, period };
}

function formatPrice(event: Event): { text: string; isFree: boolean } {
  if (event.is_free) return { text: "Free", isFree: true };
  if (event.price_min === null) return { text: "TBD", isFree: false };
  if (event.price_min === event.price_max || event.price_max === null) {
    return { text: `$${event.price_min}`, isFree: false };
  }
  return { text: `$${event.price_min}+`, isFree: false };
}

interface Props {
  event: Event;
  index?: number;
}

export default function EventCard({ event, index = 0 }: Props) {
  const { time, period } = formatTime(event.start_time, event.is_all_day);
  const { text: priceText, isFree } = formatPrice(event);

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
          <span className={`sm:hidden font-mono text-xs font-medium ${isFree ? "text-[var(--cat-community)]" : "text-[var(--muted)]"}`}>
            {priceText}
          </span>
        </div>
      </div>

      {/* Price column - desktop only */}
      <div className={`hidden sm:block font-mono text-sm font-medium text-right whitespace-nowrap ${isFree ? "text-[var(--cat-community)]" : "text-[var(--muted)]"}`}>
        {priceText}
      </div>
    </Link>
  );
}
