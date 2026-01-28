"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useLiveEvents } from "@/lib/hooks/useLiveEvents";
import { usePortal } from "@/lib/portal-context";
import Link from "next/link";
import { formatTime } from "@/lib/formats";
import { getCategoryColor } from "@/components/CategoryIcon";
import { NEIGHBORHOODS, type Spot } from "@/lib/spots";
import UnifiedHeader from "@/components/UnifiedHeader";
import CollapsibleSection, { CategoryIcons } from "@/components/CollapsibleSection";

// Dynamically import components
const MapViewWrapper = dynamic(() => import("@/components/MapViewWrapper"), { ssr: false });
const NeighborhoodGrid = dynamic(() => import("@/components/NeighborhoodGrid"), { ssr: false });

// Spot categories matching detail page taxonomy
const SPOT_CATEGORIES = [
  { id: "food", label: "Restaurants", spotTypes: ["restaurant", "food_hall", "cooking_school"] },
  { id: "drinks", label: "Bars", spotTypes: ["bar", "brewery", "distillery", "winery", "rooftop", "sports_bar"] },
  { id: "nightlife", label: "Clubs", spotTypes: ["club"] },
  { id: "caffeine", label: "Coffee", spotTypes: ["coffee_shop"] },
  { id: "fun", label: "Fun", spotTypes: ["games", "eatertainment", "arcade", "karaoke", "attraction"] },
] as const;

// Distance filter for GPS mode (miles)
const NEARBY_RADIUS_MILES = 5;

type UserLocation = { lat: number; lng: number } | null;

export default function PortalHappeningNowPage() {
  const { portal } = usePortal();
  const { events, loading: eventsLoading } = useLiveEvents();
  const [userLocation, setUserLocation] = useState<UserLocation>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [, setLocationDenied] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(true);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
  const [openSpots, setOpenSpots] = useState<Spot[]>([]);
  const [spotsLoading, setSpotsLoading] = useState(false);

  // Check if location was previously granted
  useEffect(() => {
    const savedLocation = localStorage.getItem("userLocation");
    if (savedLocation) {
      try {
        const loc = JSON.parse(savedLocation);
        setUserLocation(loc);
        setShowLocationPrompt(false);
      } catch {
        // ignore
      }
    }
  }, []);

  // Fetch open spots when location or neighborhood changes
  useEffect(() => {
    const abortController = new AbortController();

    async function fetchOpenSpots() {
      setSpotsLoading(true);
      try {
        const params = new URLSearchParams();
        if (userLocation) {
          params.set("lat", userLocation.lat.toString());
          params.set("lng", userLocation.lng.toString());
        }
        if (selectedNeighborhood) {
          params.set("neighborhood", selectedNeighborhood);
        }
        params.set("limit", "50");

        const res = await fetch(`/api/spots/open?${params}`, {
          signal: abortController.signal,
        });
        const data = await res.json();
        setOpenSpots(data.spots || []);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        console.error("Error fetching open spots:", error);
        setOpenSpots([]);
      } finally {
        setSpotsLoading(false);
      }
    }

    fetchOpenSpots();

    return () => {
      abortController.abort();
    };
  }, [userLocation, selectedNeighborhood]);

  // Request user location
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationDenied(true);
      setShowLocationPrompt(false);
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(loc);
        localStorage.setItem("userLocation", JSON.stringify(loc));
        setLocationLoading(false);
        setShowLocationPrompt(false);
      },
      () => {
        setLocationLoading(false);
        setLocationDenied(true);
        setShowLocationPrompt(false);
      }
    );
  };

  const skipLocation = () => {
    setShowLocationPrompt(false);
  };

  // Calculate distance
  const getDistance = useCallback((lat: number, lng: number): number | null => {
    if (!userLocation) return null;
    const R = 3959; // Earth's radius in miles
    const dLat = ((lat - userLocation.lat) * Math.PI) / 180;
    const dLng = ((lng - userLocation.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((userLocation.lat * Math.PI) / 180) *
        Math.cos((lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, [userLocation]);

  // Filter spots by distance when GPS is active (no neighborhood selected)
  const filteredSpots = useMemo(() => {
    if (!userLocation || selectedNeighborhood) {
      // Neighborhood mode: return all spots in neighborhood
      return openSpots;
    }
    // GPS mode: filter by distance (include spots without coords at the end)
    return openSpots.filter(spot => {
      if (!spot.lat || !spot.lng) return true; // Include spots without coords
      const distance = getDistance(spot.lat, spot.lng);
      return distance !== null && distance <= NEARBY_RADIUS_MILES;
    });
  }, [openSpots, userLocation, selectedNeighborhood, getDistance]);

  // Filter events by distance when GPS is active
  const filteredEvents = useMemo(() => {
    if (!userLocation || selectedNeighborhood) {
      return events;
    }
    return events.filter(event => {
      const venue = event.venue as { lat?: number; lng?: number } | null;
      if (!venue?.lat || !venue?.lng) return true; // Include events without coords
      const distance = getDistance(venue.lat, venue.lng);
      return distance !== null && distance <= NEARBY_RADIUS_MILES;
    });
  }, [events, userLocation, selectedNeighborhood, getDistance]);

  // Group spots by category
  const groupedSpots = useMemo(() => {
    return SPOT_CATEGORIES.map((cat) => {
      const spotCats = cat.spotTypes as readonly string[];
      const categorySpots = filteredSpots.filter((s) =>
        spotCats.includes(s.spot_type || "")
      );

      // Sort by distance if location available
      if (userLocation && !selectedNeighborhood) {
        categorySpots.sort((a, b) => {
          const distA = a.lat && a.lng ? getDistance(a.lat, a.lng) || 999 : 999;
          const distB = b.lat && b.lng ? getDistance(b.lat, b.lng) || 999 : 999;
          return distA - distB;
        });
      } else {
        // Neighborhood mode: sort alphabetically
        categorySpots.sort((a, b) => a.name.localeCompare(b.name));
      }

      return {
        ...cat,
        spots: categorySpots,
      };
    }).filter((cat) => cat.spots.length > 0);
  }, [filteredSpots, userLocation, selectedNeighborhood, getDistance]);

  // Map events for display
  const mapEvents = useMemo(() => {
    return filteredEvents.map((e) => {
      const venue = e.venue as Record<string, unknown> | null;
      return {
        ...e,
        venue: venue ? {
          id: venue.id as number,
          name: venue.name as string,
          slug: venue.slug as string,
          address: venue.address as string | null,
          neighborhood: venue.neighborhood as string | null,
          city: venue.city as string | null,
          state: venue.state as string | null,
          lat: (venue.lat as number) ?? null,
          lng: (venue.lng as number) ?? null,
          typical_price_min: null,
          typical_price_max: null,
          spot_type: venue.spot_type as string | null,
        } : null,
        category_data: null,
      };
    });
  }, [filteredEvents]) as import("@/lib/search").EventWithLocation[];

  return (
    <div className="min-h-screen bg-[var(--void)]">
      <UnifiedHeader
        portalSlug={portal.slug}
        portalName={portal.name}
        branding={portal.branding}
      />

      {/* Location Prompt Overlay */}
      {showLocationPrompt && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[var(--night)] rounded-xl border border-[var(--twilight)] max-w-sm w-full p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--neon-magenta)]/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--neon-magenta)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-[var(--cream)] mb-2">Where are you?</h2>
            <p className="text-sm text-[var(--muted)] mb-6">
              Share your location or pick a neighborhood to see what&apos;s open nearby
            </p>
            <div className="space-y-3">
              <button
                onClick={requestLocation}
                disabled={locationLoading}
                className="w-full px-4 py-3 rounded-lg bg-[var(--neon-magenta)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--coral)] transition-colors disabled:opacity-50"
              >
                {locationLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Finding you...
                  </span>
                ) : (
                  "Use My Location"
                )}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[var(--twilight)]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-[var(--night)] text-[var(--muted)]">or pick a neighborhood</span>
                </div>
              </div>

              <select
                value={selectedNeighborhood || ""}
                onChange={(e) => {
                  setSelectedNeighborhood(e.target.value || null);
                  setShowLocationPrompt(false);
                }}
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--neon-amber)] transition-colors appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 0.75rem center", backgroundSize: "1.25rem" }}
              >
                <option value="">Select neighborhood...</option>
                {NEIGHBORHOODS.map((hood) => (
                  <option key={hood} value={hood}>{hood}</option>
                ))}
              </select>

              <button
                onClick={skipLocation}
                className="w-full px-4 py-2 font-mono text-sm text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
              >
                Show all of {portal.name || "Atlanta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live indicator bar */}
      <div className="sticky top-[52px] z-20 bg-[var(--night)]/95 backdrop-blur-sm border-b border-[var(--twilight)]/50">
        <div className="max-w-3xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full bg-[var(--neon-red)] animate-pulse flex-shrink-0"
                style={{ boxShadow: "0 0 6px var(--neon-red)" }}
              />
              <span className="font-mono text-xs text-[var(--muted)]">
                {filteredEvents.length} live · {filteredSpots.length} open
                {userLocation && !selectedNeighborhood && (
                  <span className="text-[var(--neon-cyan)]"> (within 5mi)</span>
                )}
              </span>
            </div>

            {/* Neighborhood selector */}
            <div className="flex items-center gap-2">
              <select
                value={selectedNeighborhood || ""}
                onChange={(e) => setSelectedNeighborhood(e.target.value || null)}
                className="px-2 py-1 rounded-md bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-[0.65rem] focus:outline-none focus:border-[var(--neon-amber)] transition-colors appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 0.25rem center", backgroundSize: "0.875rem", paddingRight: "1.25rem" }}
              >
                <option value="">All {portal.name || "Atlanta"}</option>
                {NEIGHBORHOODS.map((hood) => (
                  <option key={hood} value={hood}>{hood}</option>
                ))}
              </select>

              {userLocation ? (
                <span className="flex items-center gap-1 font-mono text-[0.6rem] text-[var(--neon-cyan)]">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="4" />
                  </svg>
                  GPS
                </span>
              ) : (
                <button
                  onClick={requestLocation}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[0.6rem] text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50 transition-colors"
                  title="Use GPS location"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Neighborhood Grid */}
      {!showLocationPrompt && (
        <div className="max-w-3xl mx-auto px-4">
          <NeighborhoodGrid
            neighborhoods={NEIGHBORHOODS}
            events={events}
            spots={openSpots}
            selectedNeighborhood={selectedNeighborhood}
            onSelectNeighborhood={setSelectedNeighborhood}
          />
        </div>
      )}

      {/* Map */}
      <div className="h-[250px] border-b border-[var(--twilight)]">
        {eventsLoading ? (
          <div className="h-full bg-[var(--dusk)] animate-pulse flex items-center justify-center">
            <span className="text-[var(--muted)] font-mono text-sm">Loading map...</span>
          </div>
        ) : (
          <MapViewWrapper events={mapEvents} userLocation={userLocation} />
        )}
      </div>

      {/* Content by category */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {eventsLoading || spotsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-6 w-32 bg-[var(--dusk)] rounded mb-3" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-20 bg-[var(--dusk)] rounded-lg" />
                  <div className="h-20 bg-[var(--dusk)] rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredEvents.length === 0 && groupedSpots.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg text-[var(--cream)] mb-2">Nothing happening right now</h2>
            <p className="text-[var(--muted)] text-sm max-w-xs mx-auto mb-4">
              {userLocation && !selectedNeighborhood
                ? "No spots open within 5 miles. Try selecting a neighborhood instead."
                : "Check back later or browse upcoming events"}
            </p>
            <Link
              href={`/${portal.slug || "atlanta"}`}
              className="inline-block px-4 py-2 bg-[var(--twilight)]/30 rounded-lg font-mono text-sm text-[var(--cream)] hover:bg-[var(--twilight)]/50 transition-colors"
            >
              Browse events
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Live Events Section */}
            {filteredEvents.length > 0 && (
              <CollapsibleSection
                title="Live Events"
                count={filteredEvents.length}
                defaultOpen={false}
                category="events"
                icon={CategoryIcons.events}
                maxItems={5}
                totalItems={filteredEvents.length}
              >
                <div className="space-y-1.5">
                  {filteredEvents.map((event) => {
                    const eventVenue = event.venue as { lat?: number; lng?: number; name?: string } | null;
                    const distance = eventVenue?.lat && eventVenue?.lng
                      ? getDistance(eventVenue.lat, eventVenue.lng)
                      : null;
                    const categoryColor = event.category ? getCategoryColor(event.category) : null;
                    const showDistance = userLocation && !selectedNeighborhood;

                    return (
                      <Link
                        key={event.id}
                        href={portal?.slug ? `/${portal.slug}?event=${event.id}` : `/events/${event.id}`}
                        scroll={false}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--twilight)] bg-[var(--dusk)]/30 hover:bg-[var(--dusk)]/60 transition-colors group"
                        style={{
                          borderLeftWidth: categoryColor ? "3px" : undefined,
                          borderLeftColor: categoryColor || undefined,
                        }}
                      >
                        <div className="flex-shrink-0 w-12 text-center">
                          <span className="font-mono text-xs text-[var(--soft)]">
                            {formatTime(event.start_time)}
                          </span>
                          <div className="flex items-center justify-center gap-1 mt-0.5">
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-[var(--neon-red)] animate-pulse"
                              style={{ boxShadow: "0 0 4px var(--neon-red)" }}
                            />
                            <span className="font-mono text-[0.5rem] text-[var(--neon-red)]">LIVE</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-[var(--cream)] truncate group-hover:text-[var(--neon-magenta)] transition-colors">
                            {event.title}
                          </div>
                          <div className="flex items-center gap-1.5 font-mono text-[0.6rem] text-[var(--muted)]">
                            <span className="truncate">{event.venue?.name}</span>
                            {showDistance && distance !== null && (
                              <>
                                <span className="opacity-40">·</span>
                                <span className="text-[var(--neon-cyan)]">
                                  {distance < 0.1 ? "< 0.1" : distance.toFixed(1)} mi
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        {event.is_free && (
                          <span className="flex-shrink-0 px-1.5 py-0.5 text-[0.5rem] font-mono font-medium bg-[var(--neon-green)]/20 text-[var(--neon-green)] rounded">
                            FREE
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </CollapsibleSection>
            )}

            {/* Spot Category Sections */}
            {groupedSpots.map((category) => (
              <CollapsibleSection
                key={category.id}
                title={category.label}
                count={category.spots.length}
                defaultOpen={false}
                category={category.id as "food" | "drinks" | "nightlife" | "caffeine" | "fun"}
                icon={CategoryIcons[category.id as keyof typeof CategoryIcons]}
                maxItems={5}
                totalItems={category.spots.length}
              >
                <div className="grid grid-cols-2 gap-2">
                  {category.spots.map((spot) => {
                    const distance = spot.lat && spot.lng
                      ? getDistance(spot.lat, spot.lng)
                      : null;
                    const showDistance = userLocation && !selectedNeighborhood;

                    return (
                      <Link
                        key={spot.id}
                        href={portal?.slug ? `/${portal.slug}?spot=${spot.slug}` : `/spots/${spot.slug}`}
                        scroll={false}
                        className="p-3 rounded-lg border border-[var(--twilight)] bg-[var(--dusk)]/30 hover:bg-[var(--dusk)]/60 transition-colors group"
                      >
                        <div className="font-medium text-sm text-[var(--cream)] truncate group-hover:text-[var(--neon-cyan)] transition-colors">
                          {spot.name}
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[0.55rem] text-[var(--muted)] mt-0.5">
                          {spot.neighborhood && <span>{spot.neighborhood}</span>}
                          {showDistance && distance !== null && (
                            <>
                              <span className="opacity-40">·</span>
                              <span className="text-[var(--neon-cyan)]">
                                {distance < 0.1 ? "< 0.1" : distance.toFixed(1)} mi
                              </span>
                            </>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </CollapsibleSection>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
