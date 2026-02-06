"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useMemo, useCallback } from "react";
import { usePortal } from "@/lib/portal-context";
import Link from "next/link";
import { NEIGHBORHOOD_NAMES, getNeighborhoodByName } from "@/config/neighborhoods";
import UnifiedHeader from "@/components/UnifiedHeader";
import CategoryFilterChips, { type FilterCategory } from "@/components/CategoryFilterChips";
import EventCard from "@/components/EventCard";
import SpotCard from "@/components/SpotCard";
import type { AroundMeItem, AroundMeSpot, AroundMeEvent } from "@/app/api/around-me/route";

// Dynamically import map component
const MapViewWrapper = dynamic(() => import("@/components/MapViewWrapper"), { ssr: false });

// Distance filter (miles)
const NEARBY_RADIUS_MILES = 2;
const DEFAULT_RADIUS_MILES = 5;

type UserLocation = { lat: number; lng: number } | null;

export default function WhatsOpenPage() {
  const { portal } = usePortal();
  const [userLocation, setUserLocation] = useState<UserLocation>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [, setLocationDenied] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(true);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>("all");
  const [items, setItems] = useState<AroundMeItem[]>([]);
  const [counts, setCounts] = useState<{ spots: number; events: number; total: number }>({ spots: 0, events: 0, total: 0 });
  const [loading, setLoading] = useState(false);

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

  // Fetch around-me data when location, neighborhood, or category changes
  useEffect(() => {
    const abortController = new AbortController();

    async function fetchAroundMe() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (userLocation) {
          params.set("lat", userLocation.lat.toString());
          params.set("lng", userLocation.lng.toString());
        }
        if (selectedNeighborhood) {
          params.set("neighborhood", selectedNeighborhood);
        }
        if (selectedCategory !== "all") {
          params.set("category", selectedCategory);
        }
        if (userLocation && !selectedNeighborhood) {
          // GPS nearby mode: tight radius
          params.set("radius", NEARBY_RADIUS_MILES.toString());
        } else if (selectedNeighborhood) {
          // Neighborhood mode: use neighborhood's actual radius (meters -> miles, with padding)
          const hood = getNeighborhoodByName(selectedNeighborhood);
          const radiusMiles = hood ? Math.max((hood.radius / 1609.34) * 1.5, 1) : DEFAULT_RADIUS_MILES;
          params.set("radius", radiusMiles.toFixed(1));
        } else {
          // All of Atlanta: wide radius to capture everything
          params.set("radius", "25");
        }
        params.set("limit", "100");

        const res = await fetch(`/api/around-me?${params}`, {
          signal: abortController.signal,
        });
        const data = await res.json();
        setItems(data.items || []);
        setCounts(data.counts || { spots: 0, events: 0, total: 0 });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        console.error("Error fetching around-me data:", error);
        setItems([]);
        setCounts({ spots: 0, events: 0, total: 0 });
      } finally {
        setLoading(false);
      }
    }

    // Don't fetch if still showing prompt (no location chosen)
    if (!showLocationPrompt || userLocation || selectedNeighborhood) {
      fetchAroundMe();
    }

    return () => {
      abortController.abort();
    };
  }, [userLocation, selectedNeighborhood, selectedCategory, showLocationPrompt]);

  // Request user location
  const requestLocation = useCallback(() => {
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
  }, []);

  const skipLocation = () => {
    setShowLocationPrompt(false);
  };

  // Convert items to map format
  // Note: We create partial objects that contain only the fields MapView actually uses
  const { mapEvents, mapSpots } = useMemo(() => {
    type MapEvent = import("@/lib/search").EventWithLocation;
    type MapSpot = import("@/lib/spots").Spot;
    const events: MapEvent[] = [];
    const spots: MapSpot[] = [];

    for (const item of items) {
      if (item.type === "event") {
        const eventData = item.data as AroundMeEvent;
        // MapView only uses: id, title, category, venue (name, lat, lng, neighborhood, venue_type),
        // is_live, is_free, price_min, price_max, start_time
        events.push({
          id: eventData.id,
          title: eventData.title,
          description: null,
          slug: eventData.slug,
          start_time: eventData.start_time,
          end_time: eventData.end_time,
          start_date: eventData.start_time?.split("T")[0] || "",
          end_date: null,
          is_all_day: eventData.is_all_day,
          category: eventData.category,
          subcategory: eventData.subcategory,
          category_id: null,
          subcategory_id: null,
          tags: null,
          genres: null,
          is_free: eventData.is_free,
          price_min: eventData.price_min,
          price_max: eventData.price_max,
          price_note: null,
          ticket_url: eventData.ticket_url,
          image_url: null,
          source_url: "",
          is_live: true,
          venue: eventData.venue ? {
            id: eventData.venue.id,
            name: eventData.venue.name,
            slug: eventData.venue.slug,
            address: null,
            neighborhood: eventData.venue.neighborhood,
            city: "",
            state: "",
            lat: eventData.lat,
            lng: eventData.lng,
            typical_price_min: null,
            typical_price_max: null,
          } : null,
          category_data: null,
        } as MapEvent);
      } else {
        const spotData = item.data as AroundMeSpot;
        spots.push({
          id: spotData.id,
          name: spotData.name,
          slug: spotData.slug,
          address: spotData.address,
          neighborhood: spotData.neighborhood,
          city: "",
          state: "",
          lat: spotData.lat,
          lng: spotData.lng,
          venue_type: spotData.venue_type,
          venue_types: spotData.venue_types,
          description: null,
          short_description: null,
          price_level: spotData.price_level,
          website: null,
          instagram: null,
          hours_display: null,
          vibes: spotData.vibes,
          image_url: spotData.image_url,
          featured: false,
          active: true,
        });
      }
    }

    return { mapEvents: events, mapSpots: spots };
  }, [items]);

  // Neighborhood center point and radius for map
  const neighborhoodCenter = useMemo(() => {
    if (!selectedNeighborhood) return null;
    const hood = getNeighborhoodByName(selectedNeighborhood);
    if (!hood) return null;
    return { lat: hood.lat, lng: hood.lng, radius: hood.radius };
  }, [selectedNeighborhood]);

  // Mode label for status bar
  const modeLabel = useMemo(() => {
    if (selectedNeighborhood) {
      return selectedNeighborhood;
    }
    if (userLocation) {
      return `within ${NEARBY_RADIUS_MILES}mi`;
    }
    return "All of Atlanta";
  }, [selectedNeighborhood, userLocation]);

  return (
    <div className="min-h-screen bg-[var(--void)]">
      <UnifiedHeader
        portalSlug={portal.slug}
        portalName={portal.name}
        branding={portal.branding}
      />

      {/* Location Prompt Overlay */}
      {showLocationPrompt && (
        <div className="fixed inset-0 z-[1000] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[var(--night)] rounded-xl border border-[var(--twilight)] max-w-sm w-full p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--neon-green)]/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--neon-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-[var(--cream)] mb-2">What&apos;s Open?</h2>
            <p className="text-sm text-[var(--muted)] mb-6">
              Share your location to find what&apos;s open and happening nearby
            </p>
            <div className="space-y-3">
              <button
                onClick={requestLocation}
                disabled={locationLoading}
                className="w-full px-4 py-3 rounded-lg bg-[var(--neon-green)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--neon-green)]/80 transition-colors disabled:opacity-50"
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
                  <>
                    <span className="mr-2">📍</span>
                    Use My Location
                  </>
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
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--neon-amber)] transition-colors appearance-none cursor-pointer select-chevron-lg"
              >
                <option value="">Select neighborhood...</option>
                {NEIGHBORHOOD_NAMES.map((hood) => (
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

      {/* Status Bar - simplified for mobile, sticky below header */}
      <div className="sticky top-[52px] z-20 bg-[var(--night)]/95 backdrop-blur-sm border-b border-[var(--twilight)]/50">
        <div className="max-w-3xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-2">
            {/* Location selector - left side for prominence */}
              <select
                value={selectedNeighborhood || (userLocation ? "__nearby__" : "")}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "__nearby__") {
                    setSelectedNeighborhood(null);
                    requestLocation();
                  } else if (val === "") {
                    setSelectedNeighborhood(null);
                    setUserLocation(null);
                    localStorage.removeItem("userLocation");
                  } else {
                    setSelectedNeighborhood(val);
                    setUserLocation(null);
                    localStorage.removeItem("userLocation");
                  }
                }}
                className="flex-1 max-w-[200px] px-3 py-1.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors appearance-none cursor-pointer select-chevron-md"
              >
              <option value="__nearby__">{userLocation ? "📍 Nearby" : "📍 Use my location"}</option>
              <option value="">All of Atlanta</option>
              {NEIGHBORHOOD_NAMES.map((hood) => (
                <option key={hood} value={hood}>{hood}</option>
              ))}
            </select>

            {/* Single unified count badge - right side */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--neon-green)]/30 bg-[var(--neon-green)]/10"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--neon-green)] opacity-40" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--neon-green)]" />
              </span>
              <span className="font-mono text-sm font-medium text-[var(--neon-green)]">
                {counts.total} live
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter Chips - moved above map for better mobile UX */}
      <div className="max-w-3xl mx-auto px-4 pt-3">
        <CategoryFilterChips
          selected={selectedCategory}
          onChange={setSelectedCategory}
        />
      </div>

      {/* Map - reduced height on mobile to show more content */}
      <div className="max-w-3xl mx-auto px-4 pt-3">
        <div className="h-[35vh] sm:h-[400px] rounded-xl overflow-hidden border border-[var(--twilight)]">
          {loading && items.length === 0 ? (
            <div className="h-full bg-[var(--dusk)] animate-pulse flex items-center justify-center">
              <span className="text-[var(--muted)] font-mono text-sm">Loading map...</span>
            </div>
          ) : (
            <MapViewWrapper
              events={mapEvents}
              spots={mapSpots}
              userLocation={userLocation}
              viewRadius={userLocation && !selectedNeighborhood ? NEARBY_RADIUS_MILES : undefined}
              centerPoint={neighborhoodCenter}
              fitAllMarkers={!userLocation && !selectedNeighborhood}
            />
          )}
        </div>
      </div>

      {/* Mixed List */}
      <main className="max-w-3xl mx-auto px-4 py-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-24 bg-[var(--dusk)] rounded-lg" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg text-[var(--cream)] mb-2">Nothing open right now</h2>
            <p className="text-[var(--muted)] text-sm max-w-xs mx-auto mb-4">
              {modeLabel !== "All of Atlanta"
                ? `No spots or events found ${modeLabel}. Try expanding your search.`
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
          <div>
            {/* Section header */}
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
                Sorted by distance
              </h2>
              <span className="font-mono text-xs text-[var(--muted)]">
                {items.length} {items.length === 1 ? "result" : "results"}
              </span>
            </div>

            {/* Items list */}
            {items.map((item, index) => {
              if (item.type === "event") {
                const e = item.data as AroundMeEvent;
                return (
                  <EventCard
                    key={`event-${item.id}`}
                    index={index}
                    portalSlug={portal.slug}
                    event={{
                      id: e.id,
                      title: e.title,
                      description: null,
                      start_date: e.start_time?.split("T")[0] || "",
                      start_time: e.start_time,
                      end_date: null,
                      end_time: e.end_time,
                      is_all_day: e.is_all_day,
                      category: e.category,
                      subcategory: e.subcategory,
                      category_id: null,
                      subcategory_id: null,
                      tags: null,
                      genres: null,
                      is_free: e.is_free,
                      price_min: e.price_min,
                      price_max: e.price_max,
                      price_note: null,
                      source_url: "",
                      ticket_url: e.ticket_url,
                      image_url: null,
                      is_live: true,
                      venue: e.venue ? {
                        id: e.venue.id,
                        name: e.venue.name,
                        slug: e.venue.slug,
                        address: null,
                        neighborhood: e.venue.neighborhood,
                        city: "",
                        state: "",
                      } : null,
                    }}
                  />
                );
              } else {
                const s = item.data as AroundMeSpot;
                return (
                  <SpotCard
                    key={`spot-${item.id}`}
                    index={index}
                    portalSlug={portal.slug}
                    showDistance={userLocation || undefined}
                    tags={s.tags} // Pass batch-loaded tags to prevent N+1 queries
                    spot={{
                      id: s.id,
                      name: s.name,
                      slug: s.slug,
                      address: s.address,
                      neighborhood: s.neighborhood,
                      city: "",
                      state: "",
                      lat: s.lat,
                      lng: s.lng,
                      venue_type: s.venue_type,
                      venue_types: s.venue_types,
                      description: null,
                      short_description: null,
                      price_level: s.price_level,
                      website: null,
                      instagram: null,
                      hours_display: null,
                      vibes: s.vibes,
                      image_url: s.image_url,
                      featured: false,
                      active: true,
                    }}
                  />
                );
              }
            })}
          </div>
        )}
      </main>
    </div>
  );
}
