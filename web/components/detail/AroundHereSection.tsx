"use client";

import { useState, useMemo } from "react";
import Image from "@/components/SmartImage";
import CategoryIcon from "@/components/CategoryIcon";
import { OpenStatusBadge } from "@/components/HoursSection";
import { type HoursData } from "@/lib/hours";
import PlaceEventsByDay from "@/components/PlaceEventsByDay";
import PlaceShowtimes, { type ShowtimeEvent } from "@/components/PlaceShowtimes";
import { formatTimeSplit } from "@/lib/formats";
import { SectionHeader } from "@/components/detail/SectionHeader";
import { getSpotTypeLabel } from "@/lib/spots-constants";

// ─── Types ──────────────────────────────────────────────────────────────────

export type NearbyDestination = {
  id: number;
  name: string;
  slug: string;
  place_type: string | null;
  neighborhood: string | null;
  distance?: number;
  proximity_label?: string;
  closesAt?: string;
  image_url?: string | null;
  hours?: HoursData | null;
  vibes?: string[] | null;
};

export type RelatedEvent = {
  id: number;
  title: string;
  start_date: string;
  end_date?: string | null;
  start_time: string | null;
  end_time?: string | null;
  distance?: number;
  proximity_label?: string;
  venue?: { id: number; name: string; slug: string; city?: string; location_designator?: string; place_type?: string } | null;
  going_count?: number;
  interested_count?: number;
  recommendation_count?: number;
  // Cinema/showtime fields
  series_id?: string | null;
  series?: {
    id: string;
    slug: string;
    title: string;
    series_type: string;
    image_url: string | null;
  } | null;
  image_url?: string | null;
  category?: string | null;
  category_id?: string | null;
  is_free?: boolean;
  price_min?: number | null;
};

interface AroundHereSectionProps {
  venueEvents: RelatedEvent[];
  nearbyEvents: RelatedEvent[];
  destinations: NearbyDestination[];
  venueName?: string;
  neighborhood?: string | null;
  portalSlug: string;
  venueType?: string | null;
  onSpotClick: (slug: string) => void;
  onEventClick: (id: number) => void;
}

const MAX_NEARBY_EVENTS = 6;
const MAX_SPOTS = 8;

// ─── Main Component ─────────────────────────────────────────────────────────

export default function AroundHereSection({
  venueEvents,
  nearbyEvents,
  destinations,
  venueName,
  neighborhood,
  portalSlug,
  venueType,
  onSpotClick,
  onEventClick,
}: AroundHereSectionProps) {
  const hasVenueEvents = venueEvents.length > 0;
  const hasNearbyEvents = nearbyEvents.length > 0;
  const hasDestinations = destinations.length > 0;

  if (!hasVenueEvents && !hasNearbyEvents && !hasDestinations) return null;

  return (
    <div className="mt-8 space-y-6">
      {/* A. More at {Venue Name} */}
      {hasVenueEvents && (
        <MoreAtVenue
          events={venueEvents}
          venueName={venueName || "This Venue"}
          venueType={venueType}
          portalSlug={portalSlug}
          onEventClick={onEventClick}
        />
      )}

      {/* B. Also Happening Nearby */}
      {hasNearbyEvents && (
        <AlsoHappeningNearby
          events={nearbyEvents}
          onEventClick={onEventClick}
        />
      )}

      {/* C. Before & After in {Neighborhood} */}
      {hasDestinations && (
        <BeforeAndAfter
          destinations={destinations}
          neighborhood={neighborhood}
          onSpotClick={onSpotClick}
        />
      )}
    </div>
  );
}

// ─── A. More at Venue ───────────────────────────────────────────────────────

const CINEMA_VENUE_TYPES = new Set(["cinema", "theater"]);

function MoreAtVenue({
  events,
  venueName,
  venueType,
  portalSlug,
  onEventClick,
}: {
  events: RelatedEvent[];
  venueName: string;
  venueType?: string | null;
  portalSlug: string;
  onEventClick: (id: number) => void;
}) {
  const isCinemaLike = venueType ? CINEMA_VENUE_TYPES.has(venueType) : false;
  const hasSeries = events.some((e) => e.series_id || e.series);

  // Use PlaceShowtimes for cinema/theater venues with series data
  if (isCinemaLike && hasSeries) {
    return (
      <PlaceShowtimes
        events={events as ShowtimeEvent[]}
        portalSlug={portalSlug}
        venueType={venueType}
        title={`More at ${venueName}`}
        onEventClick={onEventClick}
      />
    );
  }

  return (
    <div>
      <SectionHeader title={`More at ${venueName}`} count={events.length} />
      <PlaceEventsByDay
        events={events}
        onEventClick={onEventClick}
        maxDates={5}
        compact
      />
    </div>
  );
}

// ─── B. Also Happening Nearby ───────────────────────────────────────────────

function AlsoHappeningNearby({
  events,
  onEventClick,
}: {
  events: RelatedEvent[];
  onEventClick: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? events : events.slice(0, MAX_NEARBY_EVENTS);
  const hasMore = events.length > MAX_NEARBY_EVENTS && !expanded;

  return (
    <div>
      <SectionHeader title="Also Happening Nearby" count={events.length} />
      <div className="rounded-xl border border-[var(--twilight)]/40 bg-[var(--night)] overflow-hidden">
        {visible.map((event, i) => (
          <button
            key={event.id}
            onClick={() => onEventClick(event.id)}
            className={`flex items-center gap-3 px-3 py-2.5 w-full text-left transition-colors hover:bg-[var(--dusk)] group ${
              i > 0 ? "border-t border-[var(--twilight)]/30" : ""
            }`}
          >
            {/* Category dot */}
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--coral)] flex-shrink-0" />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--cream)] truncate group-hover:text-[var(--coral)] transition-colors">
                {event.title}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                {event.venue?.name && (
                  <span className="truncate">{event.venue.name}</span>
                )}
                {event.proximity_label && (
                  <>
                    <span className="opacity-40">·</span>
                    <span className="flex-shrink-0">{event.proximity_label}</span>
                  </>
                )}
                {event.start_time && (
                  <>
                    <span className="opacity-40">·</span>
                    <span className="flex-shrink-0">
                      {formatTimeSplit(event.start_time).time}
                      {formatTimeSplit(event.start_time).period}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Chevron */}
            <svg
              className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-2 w-full py-2 text-center text-xs font-mono font-semibold tracking-wider uppercase text-[var(--coral)] hover:text-[var(--cream)] transition-colors"
        >
          +{events.length - MAX_NEARBY_EVENTS} more nearby →
        </button>
      )}
    </div>
  );
}

// ─── C. Before & After ──────────────────────────────────────────────────────

function BeforeAndAfter({
  destinations,
  neighborhood,
  onSpotClick,
}: {
  destinations: NearbyDestination[];
  neighborhood?: string | null;
  onSpotClick: (slug: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? destinations : destinations.slice(0, MAX_SPOTS);
  const hasMore = destinations.length > MAX_SPOTS && !expanded;

  const title = neighborhood
    ? `Before & After in ${neighborhood}`
    : "Before & After Nearby";

  return (
    <div>
      <SectionHeader title={title} count={destinations.length} />

      {/* Mobile: horizontal scroll / Desktop: 2-col grid */}
      <div className="sm:hidden -mx-4 px-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        <div className="flex gap-3 snap-x snap-mandatory pb-1">
          {visible.map((spot) => (
            <SpotCard key={spot.id} spot={spot} onClick={() => onSpotClick(spot.slug)} />
          ))}
        </div>
      </div>
      <div className="hidden sm:grid sm:grid-cols-2 gap-3">
        {visible.map((spot) => (
          <SpotCard key={spot.id} spot={spot} onClick={() => onSpotClick(spot.slug)} mobile={false} />
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-3 w-full py-2 text-center text-xs font-mono font-semibold tracking-wider uppercase text-[var(--coral)] hover:text-[var(--cream)] transition-colors"
        >
          See all {destinations.length} nearby →
        </button>
      )}
    </div>
  );
}

// ─── Spot Card ──────────────────────────────────────────────────────────────

const VENUE_TYPE_COLORS: Record<string, string> = {
  restaurant: "var(--neon-amber, #FB923C)",
  bar: "var(--vibe, #A78BFA)",
  brewery: "var(--gold, #FFD93D)",
  cocktail_bar: "var(--neon-magenta, #E855A0)",
  rooftop: "var(--neon-cyan, #00D4E8)",
  nightclub: "var(--neon-magenta, #E855A0)",
  recreation: "var(--neon-green, #00D9A0)",
  eatertainment: "var(--coral, #FF6B7A)",
  arcade: "var(--neon-cyan, #00D4E8)",
  karaoke: "var(--neon-magenta, #E855A0)",
};

function SpotCard({
  spot,
  onClick,
  mobile = true,
}: {
  spot: NearbyDestination;
  onClick: () => void;
  mobile?: boolean;
}) {
  const typeLabel = getSpotTypeLabel(spot.place_type || "");
  const accentColor = VENUE_TYPE_COLORS[spot.place_type || ""] || "var(--coral)";

  // Detect open status from hours
  const isOpen = useMemo(() => {
    if (!spot.hours) return null;
    return spot.closesAt !== undefined; // closesAt present means it's open
  }, [spot.hours, spot.closesAt]);

  return (
    <button
      onClick={onClick}
      className={`group flex-shrink-0 rounded-xl overflow-hidden border border-[var(--twilight)]/40 bg-[var(--night)] text-left transition-colors hover:border-[var(--coral)]/50 ${
        mobile ? "min-w-[240px] max-w-[280px] snap-start" : "w-full"
      }`}
    >
      {/* Image area */}
      <div className="relative h-28 overflow-hidden">
        {spot.image_url ? (
          <>
            <Image
              src={spot.image_url}
              alt={spot.name}
              fill
              sizes="280px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--night)] via-transparent to-transparent" />
          </>
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 15%, var(--night))` }}
          >
            <CategoryIcon type={spot.place_type || "restaurant"} size={28} glow="subtle" />
          </div>
        )}

        {/* Open/Closed badge overlay */}
        {isOpen !== null && (
          <div className="absolute top-2 right-2">
            <OpenStatusBadge hours={spot.hours || null} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-3 py-2.5">
        <h4 className="text-sm font-medium text-[var(--cream)] truncate group-hover:text-[var(--coral)] transition-colors">
          {spot.name}
        </h4>

        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[var(--muted)]">
          {typeLabel && (
            <span className="font-mono uppercase tracking-wider">{typeLabel}</span>
          )}
          {spot.proximity_label && (
            <>
              <span className="opacity-40">·</span>
              <span>{spot.proximity_label}</span>
            </>
          )}
        </div>

        {spot.vibes && spot.vibes.length > 0 && (
          <p className="text-xs text-[var(--soft)] mt-1 truncate">
            {spot.vibes
              .slice(0, 2)
              .map((v) => v.replace(/-/g, " "))
              .join(" · ")}
          </p>
        )}
      </div>
    </button>
  );
}
