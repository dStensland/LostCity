"use client";

import { useState, useMemo } from "react";
import Image from "@/components/SmartImage";
import { CategoryIcons, CATEGORY_COLORS } from "@/components/CollapsibleSection";
import CategoryIcon from "@/components/CategoryIcon";
import { OpenStatusBadge } from "@/components/HoursSection";
import { formatCloseTime, type HoursData } from "@/lib/hours";
import PlaceEventsByDay, { PlaceEventCard } from "@/components/PlaceEventsByDay";
import { SectionHeader } from "@/components/detail/SectionHeader";

// Unified NearbySpot type accommodating both VenueDetailView (rich) and EventDetailView (lean)
export type NearbySpot = {
  id: number;
  name: string;
  slug: string;
  spot_type?: string | null;
  venue_type?: string | null;
  neighborhood?: string | null;
  distance?: number;
  closesAt?: string;
  image_url?: string | null;
  short_description?: string | null;
  hours?: HoursData | null;
  hours_display?: string | null;
  is_24_hours?: boolean | null;
  vibes?: string[] | null;
};

export type RelatedEvent = {
  id: number;
  title: string;
  start_date: string;
  end_date?: string | null;
  start_time: string | null;
  end_time?: string | null;
  category?: string | null;
  is_free?: boolean;
  price_min?: number | null;
  venue?: { id: number; name: string; slug: string; city?: string; neighborhood?: string | null; location_designator?: string } | null;
  going_count?: number;
  interested_count?: number;
  recommendation_count?: number;
};

export type NearbySpots = {
  food: NearbySpot[];
  drinks: NearbySpot[];
  nightlife: NearbySpot[];
  caffeine: NearbySpot[];
  fun: NearbySpot[];
};

interface NearbySectionProps {
  nearbySpots: NearbySpots;
  venueEvents?: RelatedEvent[];
  nearbyEvents?: RelatedEvent[];
  venueName?: string;
  onSpotClick: (slug: string) => void;
  onEventClick?: (id: number) => void;
}

const SPOT_TYPE_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  food_hall: "Food Hall",
  cooking_school: "Cooking School",
  bar: "Bar",
  brewery: "Brewery",
  distillery: "Distillery",
  winery: "Winery",
  rooftop: "Rooftop",
  sports_bar: "Sports Bar",
  club: "Club",
  coffee_shop: "Coffee",
  games: "Games",
  eatertainment: "Eatertainment",
  arcade: "Arcade",
  karaoke: "Karaoke",
};

type TabKey = "events" | "food" | "drinks" | "nightlife" | "caffeine" | "fun";

const TAB_LABELS: Record<TabKey, string> = {
  events: "Events",
  food: "Food",
  drinks: "Drinks",
  nightlife: "Nightlife",
  caffeine: "Caffeine",
  fun: "Fun",
};

const ITEMS_PER_TAB = 6;

export default function NearbySection({
  nearbySpots,
  venueEvents,
  nearbyEvents,
  venueName,
  onSpotClick,
  onEventClick,
}: NearbySectionProps) {
  const [activeTab, setActiveTab] = useState<TabKey | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Build tabs for populated categories only
  const tabs = useMemo(() => {
    const result: { key: TabKey; count: number }[] = [];

    // Events tab (EventDetailView only)
    const eventCount = (venueEvents?.length || 0) + (nearbyEvents?.length || 0);
    if (eventCount > 0) {
      result.push({ key: "events", count: eventCount });
    }

    const spotKeys: (keyof NearbySpots)[] = ["food", "drinks", "nightlife", "caffeine", "fun"];
    for (const key of spotKeys) {
      if (nearbySpots[key].length > 0) {
        result.push({ key, count: nearbySpots[key].length });
      }
    }

    return result;
  }, [nearbySpots, venueEvents, nearbyEvents]);

  // Default to first populated tab
  const effectiveTab = activeTab && tabs.some((t) => t.key === activeTab)
    ? activeTab
    : tabs[0]?.key || null;

  // Nothing to show
  if (tabs.length === 0) return null;

  const handleTabClick = (key: TabKey) => {
    setActiveTab(key);
    setExpanded(false);
  };

  const showTabBar = tabs.length > 1;
  const currentItems =
    effectiveTab && effectiveTab !== "events"
      ? nearbySpots[effectiveTab as keyof NearbySpots]
      : [];
  const visibleItems = expanded ? currentItems : currentItems.slice(0, ITEMS_PER_TAB);
  const hasMore = currentItems.length > ITEMS_PER_TAB && !expanded;

  return (
    <div className="mt-8">
      {/* Header */}
      <SectionHeader title="Around Here" />

      {/* Category Tab Bar */}
      {showTabBar && (
        <div className="mb-4 -mx-4 px-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <div className="flex gap-2">
            {tabs.map((tab) => {
              const isActive = tab.key === effectiveTab;
              const accentColor =
                CATEGORY_COLORS[tab.key as keyof typeof CATEGORY_COLORS] ||
                CATEGORY_COLORS.events;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabClick(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                    isActive
                      ? "text-[var(--void)]"
                      : "bg-[var(--twilight)] text-[var(--soft)] hover:text-[var(--cream)]"
                  }`}
                  style={isActive ? { backgroundColor: accentColor } : undefined}
                >
                  <span className="flex-shrink-0 [&>svg]:w-4 [&>svg]:h-4">
                    {CategoryIcons[tab.key as keyof typeof CategoryIcons]}
                  </span>
                  {TAB_LABELS[tab.key]}
                  <span
                    className={`font-mono text-xs ${isActive ? "opacity-80" : "opacity-60"}`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Content */}
      {effectiveTab === "events" ? (
        <EventsTabContent
          venueEvents={venueEvents}
          nearbyEvents={nearbyEvents}
          venueName={venueName}
          onEventClick={onEventClick}
        />
      ) : (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {visibleItems.map((spot) => (
              <NearbySpotCard
                key={spot.id}
                spot={spot}
                onClick={() => onSpotClick(spot.slug)}
              />
            ))}
          </div>
          {hasMore && (
            <button
              onClick={() => setExpanded(true)}
              className="mt-3 w-full py-2 text-center text-xs font-mono font-semibold tracking-wider uppercase text-[var(--coral)] hover:text-[var(--cream)] transition-colors"
            >
              See all {currentItems.length} →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// --- Subcomponents ---

function NearbySpotCard({ spot, onClick }: { spot: NearbySpot; onClick: () => void }) {
  const spotType = spot.spot_type || spot.venue_type;
  const typeLabel = SPOT_TYPE_LABELS[spotType || ""] || spotType;

  return (
    <button
      onClick={onClick}
      className="block w-full text-left find-row-card border border-[var(--twilight)]/75 rounded-xl px-3 py-2.5 overflow-hidden group transition-colors hover:border-[var(--coral)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)]"
      style={{ background: "linear-gradient(180deg, color-mix(in srgb, var(--night) 82%, transparent), color-mix(in srgb, var(--dusk) 64%, transparent))" }}
    >
      <div className="flex items-start gap-2.5">
        {/* Thumbnail or Category Icon */}
        {spot.image_url ? (
          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--twilight)]">
            <Image
              src={spot.image_url}
              alt={spot.name}
              width={40}
              height={40}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-[var(--twilight)]">
            <CategoryIcon type={spotType || "restaurant"} size={18} glow="subtle" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-[var(--cream)] text-sm font-medium truncate group-hover:text-[var(--coral)] transition-colors">
              {spot.name}
            </h4>
            {(spot.hours || spot.is_24_hours) && (
              <OpenStatusBadge
                hours={spot.hours || null}
                is24Hours={spot.is_24_hours || false}
              />
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-0.5">
            {typeLabel && (
              <span className="text-xs text-[var(--muted)] font-mono uppercase tracking-wider">
                {typeLabel}
              </span>
            )}
            {spot.distance !== undefined && (
              <span className="text-xs text-[var(--muted)] font-mono">
                · {spot.distance < 0.1 ? "Nearby" : `${spot.distance.toFixed(1)} mi`}
              </span>
            )}
            {spot.closesAt && spot.distance === undefined && (
              <span className="text-xs text-[var(--neon-amber)] font-mono">
                · til {formatCloseTime(spot.closesAt)}
              </span>
            )}
          </div>

          {spot.vibes && spot.vibes.length > 0 && (
            <span className="text-xs text-[var(--soft)] mt-0.5 block truncate">
              {spot.vibes
                .slice(0, 2)
                .map((v) => v.replace(/-/g, " "))
                .join(" · ")}
            </span>
          )}
        </div>

        <svg
          className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors flex-shrink-0 mt-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </button>
  );
}

function EventsTabContent({
  venueEvents,
  nearbyEvents,
  venueName,
  onEventClick,
}: {
  venueEvents?: RelatedEvent[];
  nearbyEvents?: RelatedEvent[];
  venueName?: string;
  onEventClick?: (id: number) => void;
}) {
  const hasVenueEvents = venueEvents && venueEvents.length > 0;
  const hasNearbyEvents = nearbyEvents && nearbyEvents.length > 0;

  return (
    <div className="space-y-5">
      {hasVenueEvents && (
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--muted)] mb-2">
            At {venueName || "this spot"}
          </h3>
          <PlaceEventsByDay
            events={venueEvents}
            onEventClick={onEventClick}
            maxDates={5}
            compact={true}
          />
        </div>
      )}

      {hasNearbyEvents && (
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--muted)] mb-2">
            Nearby
          </h3>
          <div className="space-y-2">
            {nearbyEvents.map((event) => (
              <PlaceEventCard
                key={event.id}
                event={event}
                onClick={() => onEventClick?.(event.id)}
                compact={true}
                subtitle={event.venue?.name}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
