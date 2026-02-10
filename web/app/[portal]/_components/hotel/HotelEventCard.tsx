import Link from "next/link";
import { format } from "date-fns";

/** Convert "HH:MM:SS" to "1:00 PM" style */
function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return minutes === "00" ? `${h12} ${ampm}` : `${h12}:${minutes} ${ampm}`;
}

interface HotelEventCardProps {
  event: {
    id: string;
    title: string;
    start_date: string;
    start_time?: string | null;
    image_url?: string | null;
    description?: string | null;
    venue_name?: string | null;
    category?: string | null;
    is_free?: boolean;
    price_min?: number | null;
    distance_km?: number | null;
  };
  portalSlug: string;
  variant?: "featured" | "compact";
}

/**
 * Hotel-themed event card
 * Featured: Large 16:9 image, generous padding, serif title
 * Compact: 80x80 thumbnail with inline layout
 *
 * Uses <img> instead of next/image to avoid unconfigured hostname errors
 * from event images across many external domains.
 */
export default function HotelEventCard({ event, portalSlug, variant = "featured" }: HotelEventCardProps) {
  const eventUrl = `/${portalSlug}?event=${event.id}`;

  // Format distance if available
  const distanceText = event.distance_km
    ? event.distance_km < 1
      ? `${Math.round(event.distance_km * 1000)}m away`
      : `${event.distance_km.toFixed(1)}km away`
    : null;

  if (variant === "compact") {
    return (
      <Link
        href={eventUrl}
        className="group flex gap-4 bg-[var(--hotel-cream)] rounded-lg overflow-hidden p-4 hover:shadow-[var(--hotel-shadow-medium)] transition-shadow duration-500"
      >
        {/* Thumbnail */}
        <div className="relative w-20 h-20 flex-shrink-0 rounded-md overflow-hidden bg-[var(--hotel-sand)]">
          {event.image_url ? (
            <img
              src={event.image_url}
              alt={event.title}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-[var(--hotel-sand)]" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-medium text-lg text-[var(--hotel-charcoal)] tracking-tight leading-tight line-clamp-2 mb-1">
            {event.title}
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-sm font-body">
            {event.venue_name && (
              <span className="text-[var(--hotel-stone)]">{event.venue_name}</span>
            )}
            {distanceText && (
              <>
                <span className="text-[var(--hotel-stone)]">&middot;</span>
                <span className="text-[var(--hotel-stone)]">{distanceText}</span>
              </>
            )}
          </div>
          {event.start_time && (
            <p className="text-sm font-body text-[var(--hotel-champagne)] mt-1">
              {formatTime(event.start_time)}
            </p>
          )}
        </div>
      </Link>
    );
  }

  // Featured variant
  return (
    <Link
      href={eventUrl}
      className="group block bg-[var(--hotel-cream)] rounded-lg overflow-hidden shadow-[var(--hotel-shadow-soft)] hover:shadow-[var(--hotel-shadow-medium)] transition-shadow duration-500"
    >
      {/* Image */}
      <div className="relative aspect-[16/9] overflow-hidden bg-[var(--hotel-sand)]">
        {event.image_url ? (
          <img
            src={event.image_url}
            alt={event.title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-[var(--hotel-sand)]" />
        )}
      </div>

      {/* Content */}
      <div className="p-6 space-y-3">
        {/* Date & Time */}
        <p className="text-xs font-body text-[var(--hotel-stone)] uppercase tracking-[0.15em]">
          {format(new Date(event.start_date), "EEEE, MMM d")}
          {event.start_time && ` \u00B7 ${formatTime(event.start_time)}`}
        </p>

        {/* Title */}
        <h3 className="font-display font-semibold text-xl md:text-2xl text-[var(--hotel-charcoal)] tracking-tight leading-tight line-clamp-2">
          {event.title}
        </h3>

        {/* Description */}
        {event.description && (
          <p className="text-sm font-body text-[var(--hotel-stone)] line-clamp-2 leading-relaxed">
            {event.description}
          </p>
        )}

        {/* Venue & Distance */}
        <div className="flex flex-wrap items-center gap-2 text-sm font-body text-[var(--hotel-stone)]">
          {event.venue_name && <span>{event.venue_name}</span>}
          {distanceText && (
            <>
              <span>&middot;</span>
              <span>{distanceText}</span>
            </>
          )}
        </div>

        {/* Price */}
        {(event.is_free || (event.price_min !== null && event.price_min !== undefined)) && (
          <p className="text-sm font-body text-[var(--hotel-champagne)]">
            {event.is_free || event.price_min === 0 ? "Complimentary for Guests" : `From $${event.price_min}`}
          </p>
        )}
      </div>
    </Link>
  );
}
