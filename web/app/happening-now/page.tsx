"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useMemo, useCallback } from "react";
// Note: useCallback still needed for getDistance and requestLocation
import { useLiveEvents } from "@/lib/hooks/useLiveEvents";
import Link from "next/link";
import { formatTime } from "@/lib/formats";
import CategoryIcon, { getCategoryColor, getCategoryLabel } from "@/components/CategoryIcon";
import { SPOT_TYPES, type Spot } from "@/lib/spots";

// Dynamically import components
const GlassHeader = dynamic(() => import("@/components/GlassHeader"), { ssr: false });
const MainNav = dynamic(() => import("@/components/MainNav"), { ssr: false });
const MapViewWrapper = dynamic(() => import("@/components/MapViewWrapper"), { ssr: false });

// Categories for grouping
const CATEGORIES = [
  { id: "music", label: "Music & Entertainment", eventCategories: ["music", "comedy", "theater"], spotTypes: ["music_venue", "comedy_club", "theater"] },
  { id: "food_drink", label: "Food & Drinks", eventCategories: ["food_drink", "nightlife"], spotTypes: ["restaurant", "bar", "brewery"] },
  { id: "coffee", label: "Coffee & Chill", eventCategories: [], spotTypes: ["coffee_shop"] },
  { id: "art", label: "Art & Culture", eventCategories: ["art", "film"], spotTypes: ["gallery", "museum"] },
  { id: "other", label: "Other", eventCategories: ["community", "sports", "fitness"], spotTypes: [] },
] as const;

type UserLocation = { lat: number; lng: number } | null;

export default function HappeningNowPage() {
  const { events, loading: eventsLoading, count } = useLiveEvents();
  const [userLocation, setUserLocation] = useState<UserLocation>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(true);
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

  // Fetch open spots when location changes
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
        params.set("limit", "20");

        const res = await fetch(`/api/spots/open?${params}`, {
          signal: abortController.signal,
        });
        const data = await res.json();
        setOpenSpots(data.spots || []);
      } catch (error) {
        // Ignore abort errors
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
  }, [userLocation]);

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

  // Group events and spots by category
  const groupedContent = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const eventCats = cat.eventCategories as readonly string[];
      const spotCats = cat.spotTypes as readonly string[];
      const categoryEvents = events.filter((e) =>
        eventCats.includes(e.category || "")
      );
      const categorySpots = openSpots.filter((s) =>
        spotCats.includes(s.spot_type || "")
      );

      // Sort by distance if location available
      if (userLocation) {
        categoryEvents.sort((a, b) => {
          const venueA = a.venue as { lat?: number; lng?: number } | null;
          const venueB = b.venue as { lat?: number; lng?: number } | null;
          const distA = venueA?.lat && venueA?.lng ? getDistance(venueA.lat, venueA.lng) || 999 : 999;
          const distB = venueB?.lat && venueB?.lng ? getDistance(venueB.lat, venueB.lng) || 999 : 999;
          return distA - distB;
        });
        categorySpots.sort((a, b) => {
          const distA = a.lat && a.lng ? getDistance(a.lat, a.lng) || 999 : 999;
          const distB = b.lat && b.lng ? getDistance(b.lat, b.lng) || 999 : 999;
          return distA - distB;
        });
      }

      return {
        ...cat,
        events: categoryEvents,
        spots: categorySpots,
        total: categoryEvents.length + categorySpots.length,
      };
    }).filter((cat) => cat.total > 0);
  }, [events, openSpots, userLocation, getDistance]);

  // Map events for display - cast to EventWithLocation type
  const mapEvents = useMemo(() => {
    return events.map((e) => {
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
  }, [events]) as import("@/lib/search").EventWithLocation[];

  return (
    <div className="min-h-screen bg-[var(--void)]">
      <GlassHeader />
      <MainNav />

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
              Share your location to see what&apos;s happening nearby, sorted by distance
            </p>
            <div className="space-y-2">
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
              <button
                onClick={skipLocation}
                className="w-full px-4 py-2 font-mono text-sm text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live indicator bar */}
      <div className="sticky top-[104px] z-20 bg-[var(--night)]/95 backdrop-blur-sm border-b border-[var(--twilight)]/50">
        <div className="max-w-3xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full bg-[var(--neon-red)] animate-pulse"
                style={{ boxShadow: "0 0 6px var(--neon-red)" }}
              />
              <span className="font-mono text-xs text-[var(--muted)]">
                {count} live {count === 1 ? "event" : "events"} · {openSpots.length} spots open
              </span>
            </div>
            {userLocation ? (
              <span className="flex items-center gap-1.5 font-mono text-[0.65rem] text-[var(--neon-cyan)]">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="4" />
                </svg>
                Using your location
              </span>
            ) : (
              <button
                onClick={requestLocation}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg font-mono text-[0.65rem] text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                Enable location
              </button>
            )}
          </div>
        </div>
      </div>

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
        ) : groupedContent.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg text-[var(--cream)] mb-2">Nothing happening right now</h2>
            <p className="text-[var(--muted)] text-sm max-w-xs mx-auto mb-4">
              Check back later or browse upcoming events
            </p>
            <Link
              href="/atlanta"
              className="inline-block px-4 py-2 bg-[var(--twilight)]/30 rounded-lg font-mono text-sm text-[var(--cream)] hover:bg-[var(--twilight)]/50 transition-colors"
            >
              Browse events
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedContent.map((category) => (
              <section key={category.id}>
                {/* Category header */}
                <div className="flex items-center gap-2 mb-3">
                  <CategoryIcon type={category.id} size={18} className="opacity-70" />
                  <h2 className="font-mono text-sm font-medium text-[var(--cream)]">
                    {category.label}
                  </h2>
                  <span className="font-mono text-xs text-[var(--muted)]">
                    ({category.total})
                  </span>
                </div>

                {/* Events in this category */}
                {category.events.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-[var(--neon-red)]"
                        style={{ boxShadow: "0 0 4px var(--neon-red)" }}
                      />
                      <span className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider">
                        Live Events
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {category.events.slice(0, 5).map((event) => {
                        const eventVenue = event.venue as { lat?: number; lng?: number; name?: string } | null;
                        const distance = eventVenue?.lat && eventVenue?.lng
                          ? getDistance(eventVenue.lat, eventVenue.lng)
                          : null;
                        const categoryColor = event.category ? getCategoryColor(event.category) : null;

                        return (
                          <Link
                            key={event.id}
                            href={`/events/${event.id}`}
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
                                {distance !== null && distance < 50 && (
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
                  </div>
                )}

                {/* Spots in this category */}
                {category.spots.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-green)]" />
                      <span className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider">
                        Open Now
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {category.spots.slice(0, 6).map((spot) => {
                        const distance = spot.lat && spot.lng
                          ? getDistance(spot.lat, spot.lng)
                          : null;

                        return (
                          <Link
                            key={spot.id}
                            href={`/spots/${spot.slug}`}
                            className="p-3 rounded-lg border border-[var(--twilight)] bg-[var(--dusk)]/30 hover:bg-[var(--dusk)]/60 transition-colors group"
                          >
                            <div className="font-medium text-sm text-[var(--cream)] truncate group-hover:text-[var(--neon-cyan)] transition-colors">
                              {spot.name}
                            </div>
                            <div className="flex items-center gap-1.5 font-mono text-[0.55rem] text-[var(--muted)] mt-0.5">
                              {spot.neighborhood && <span>{spot.neighborhood}</span>}
                              {distance !== null && distance < 50 && (
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
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
