import Link from "next/link";
import Image from "next/image";
import type { DogEvent, DogVenue } from "@/lib/dog-data";
import { DOG_CONTENT_COLORS, classifyDogContentType } from "@/lib/dog-art";
import { getProxiedImageSrc } from "@/lib/image-proxy";
import DogTagChips from "./DogTagChips";

/* ------------------------------------------------------------------ */
/*  Event Card                                                         */
/* ------------------------------------------------------------------ */

function formatEventDate(event: DogEvent): string {
  const d = new Date(event.start_date + "T00:00:00");
  const day = d.toLocaleDateString("en-US", { weekday: "short" });
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const date = d.getDate();

  if (event.is_all_day) return `${day}, ${month} ${date}`;

  if (event.start_time) {
    const [h, m] = event.start_time.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "p" : "a";
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const timeStr = m === "00" ? `${h12}${ampm}` : `${h12}:${m}${ampm}`;
    return `${day} ${month} ${date} · ${timeStr}`;
  }

  return `${day}, ${month} ${date}`;
}

export function DogEventCard({
  event,
  portalSlug,
}: {
  event: DogEvent;
  portalSlug: string;
}) {
  const contentType = classifyDogContentType(
    event.venue?.name || null,
    null,
    event.tags,
    true
  );
  const accentColor = DOG_CONTENT_COLORS[contentType];

  return (
    <Link
      href={`/${portalSlug}/events/${event.id}`}
      className="dog-card flex-shrink-0 w-72 snap-start block group"
    >
      {/* Image or fallback */}
      <div className="relative h-40 overflow-hidden rounded-t-2xl">
        {event.image_url ? (
          <Image
            src={getProxiedImageSrc(event.image_url)}
            alt={event.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="288px"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: accentColor, opacity: 0.15 }}
          >
            <span
              className="text-3xl font-extrabold uppercase tracking-tight"
              style={{ color: accentColor, opacity: 0.6 }}
            >
              {contentType}
            </span>
          </div>
        )}

        {/* Price badge */}
        {event.is_free && (
          <span
            className="absolute top-3 right-3 dog-pill"
            style={{ background: "var(--dog-green)", color: "#fff" }}
          >
            Free
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <p
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: accentColor }}
        >
          {formatEventDate(event)}
        </p>
        <h3
          className="mt-1 font-bold text-sm leading-snug line-clamp-2"
          style={{ color: "var(--dog-charcoal)" }}
        >
          {event.title}
        </h3>
        {event.venue && (
          <p
            className="mt-1 text-xs truncate"
            style={{ color: "var(--dog-stone)" }}
          >
            {event.venue.name}
            {event.venue.neighborhood && ` · ${event.venue.neighborhood}`}
          </p>
        )}
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Venue Card                                                         */
/* ------------------------------------------------------------------ */

function getVenueTypeLabel(type: string | null): string {
  if (!type) return "Spot";
  const labels: Record<string, string> = {
    park: "Park",
    dog_park: "Dog Park",
    trail: "Trail",
    nature_preserve: "Nature",
    brewery: "Brewery",
    restaurant: "Restaurant",
    bar: "Bar",
    coffee_shop: "Coffee",
    cafe: "Cafe",
    vet: "Vet",
    groomer: "Groomer",
    pet_store: "Pet Store",
    pet_daycare: "Daycare",
    animal_shelter: "Shelter",
    market: "Market",
    hotel: "Hotel",
    farmers_market: "Farmers Market",
  };
  return labels[type] || type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DogVenueCard({
  venue,
  portalSlug,
  showTags = false,
}: {
  venue: DogVenue;
  portalSlug: string;
  showTags?: boolean;
}) {
  const contentType = classifyDogContentType(
    venue.venue_type,
    venue.vibes,
    null,
    false
  );
  const accentColor = DOG_CONTENT_COLORS[contentType];

  return (
    <Link
      href={`/${portalSlug}/spots/${venue.slug}`}
      className="dog-card flex-shrink-0 w-72 snap-start block group"
    >
      {/* Image or fallback */}
      <div className="relative h-40 overflow-hidden rounded-t-2xl">
        {venue.image_url ? (
          <Image
            src={getProxiedImageSrc(venue.image_url)}
            alt={venue.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="288px"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: accentColor, opacity: 0.12 }}
          >
            <span
              className="text-2xl font-extrabold uppercase tracking-tight"
              style={{ color: accentColor, opacity: 0.5 }}
            >
              {getVenueTypeLabel(venue.venue_type)}
            </span>
          </div>
        )}

        {/* Type badge */}
        <span
          className="absolute top-3 left-3 dog-pill"
          style={{ background: accentColor, color: "#fff" }}
        >
          {getVenueTypeLabel(venue.venue_type)}
        </span>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3
          className="font-bold text-sm leading-snug line-clamp-2"
          style={{ color: "var(--dog-charcoal)" }}
        >
          {venue.name}
        </h3>
        <p
          className="mt-1 text-xs truncate"
          style={{ color: "var(--dog-stone)" }}
        >
          {venue.neighborhood || venue.address || "Atlanta"}
        </p>
        {showTags && <DogTagChips vibes={venue.vibes} maxTags={3} />}
        {!showTags && venue.short_description && (
          <p
            className="mt-1.5 text-xs line-clamp-2 leading-relaxed"
            style={{ color: "var(--dog-stone)" }}
          >
            {venue.short_description}
          </p>
        )}
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Venue Row (compact list style)                                     */
/* ------------------------------------------------------------------ */

export function DogVenueRow({
  venue,
  portalSlug,
}: {
  venue: DogVenue;
  portalSlug: string;
}) {
  const contentType = classifyDogContentType(
    venue.venue_type,
    venue.vibes,
    null,
    false
  );
  const accentColor = DOG_CONTENT_COLORS[contentType];

  return (
    <Link
      href={`/${portalSlug}/spots/${venue.slug}`}
      className="dog-card p-4 flex items-center gap-3 group"
    >
      {/* Thumbnail or color swatch */}
      {venue.image_url ? (
        <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
          <Image
            src={getProxiedImageSrc(venue.image_url)}
            alt={venue.name}
            fill
            className="object-cover"
            sizes="48px"
          />
        </div>
      ) : (
        <div
          className="w-12 h-12 rounded-xl flex-shrink-0"
          style={{ background: accentColor, opacity: 0.2 }}
        />
      )}

      <div className="flex-1 min-w-0">
        <h3
          className="font-semibold text-sm truncate"
          style={{ color: "var(--dog-charcoal)" }}
        >
          {venue.name}
        </h3>
        <p className="text-xs truncate" style={{ color: "var(--dog-stone)" }}>
          {getVenueTypeLabel(venue.venue_type)}
          {venue.neighborhood && ` · ${venue.neighborhood}`}
        </p>
      </div>

      {/* Arrow */}
      <span
        className="text-sm opacity-0 group-hover:opacity-60 transition-opacity"
        style={{ color: "var(--dog-stone)" }}
      >
        &rarr;
      </span>
    </Link>
  );
}
