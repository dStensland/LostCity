import Link from "next/link";

interface HotelVenueCardProps {
  venue: {
    id?: number;
    slug: string;
    name: string;
    image_url?: string | null;
    venue_type?: string | null;
    neighborhood?: string | null;
    vibes?: string[] | null;
    distance_km?: number | null;
    next_event?: {
      title: string;
      start_date: string;
      start_time?: string | null;
    } | null;
  };
  portalSlug: string;
  variant?: "default" | "carousel";
}

/**
 * Hotel-themed venue/destination card
 * Shows venue photo, type, neighborhood, and next event
 */
export default function HotelVenueCard({ venue, portalSlug, variant = "default" }: HotelVenueCardProps) {
  const venueUrl = `/${portalSlug}?spot=${venue.slug}`;

  // Format distance if available
  const distanceText = venue.distance_km
    ? venue.distance_km < 1
      ? `${Math.round(venue.distance_km * 1000)}m away`
      : `${venue.distance_km.toFixed(1)}km away`
    : null;

  // Format venue type for display
  const venueType = venue.venue_type?.replace(/_/g, " ");

  // Get first vibe tag if available
  const vibeTag = venue.vibes?.[0];

  const isCarousel = variant === "carousel";

  return (
    <Link
      href={venueUrl}
      className={`group isolate block bg-[var(--hotel-cream)] rounded-lg overflow-hidden shadow-[var(--hotel-shadow-soft)] hover:shadow-[var(--hotel-shadow-medium)] transition-shadow duration-500 ${
        isCarousel ? "flex-shrink-0 snap-start w-[260px]" : ""
      }`}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--hotel-sand)]">
        {venue.image_url ? (
          <img
            src={venue.image_url}
            alt={venue.name}
            className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-500 transform-gpu will-change-transform [backface-visibility:hidden]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-[var(--hotel-sand)] flex items-center justify-center">
            <svg className="w-12 h-12 text-[var(--hotel-stone)] opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 space-y-3">
        {/* Venue Name */}
        <h3 className="font-display font-semibold text-xl text-[var(--hotel-charcoal)] tracking-tight leading-tight">
          {venue.name}
        </h3>

        {/* Venue Type & Neighborhood */}
        <div className="flex flex-wrap items-center gap-2 text-sm font-body text-[var(--hotel-stone)]">
          {venueType && <span className="capitalize">{venueType}</span>}
          {venue.neighborhood && (
            <>
              <span>·</span>
              <span>{venue.neighborhood}</span>
            </>
          )}
        </div>

        {/* Distance & Vibe */}
        {(distanceText || vibeTag) && (
          <div className="flex flex-wrap items-center gap-2 text-sm font-body text-[var(--hotel-stone)] italic">
            {distanceText && <span>{distanceText}</span>}
            {vibeTag && (
              <>
                {distanceText && <span>·</span>}
                <span>&ldquo;{vibeTag}&rdquo;</span>
              </>
            )}
          </div>
        )}

        {/* Next Event */}
        {venue.next_event && (
          <p className="text-sm font-body text-[var(--hotel-champagne)]">
            Next: {venue.next_event.title}
            {venue.next_event.start_time && `, ${venue.next_event.start_time}`}
          </p>
        )}
      </div>
    </Link>
  );
}
