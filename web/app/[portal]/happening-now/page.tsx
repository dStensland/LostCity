"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { usePortal } from "@/lib/portal-context";
import Link from "next/link";
import { NEIGHBORHOOD_NAMES, getNeighborhoodByName } from "@/config/neighborhoods";
import { PortalHeader } from "@/components/headers";
import CategoryFilterChips, { type FilterCategory } from "@/components/CategoryFilterChips";
import AroundMeCard from "@/components/AroundMeCard";
import { getDayPart, getHappeningNowGreeting } from "@/lib/time-greeting";
import { Crosshair, MapTrifold, Clock, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { AroundMeItem, AroundMeSpot, AroundMeEvent } from "@/app/api/around-me/route";

// Client-side category filter mapping (mirrors API CATEGORY_FILTERS)
const CLIENT_CATEGORY_FILTERS: Record<string, { spotTypes: string[]; eventCategories: string[] }> = {
  food: { spotTypes: ["restaurant", "food_hall", "cooking_school"], eventCategories: ["Food & Drink"] },
  drinks: { spotTypes: ["bar", "brewery", "distillery", "winery", "rooftop", "sports_bar"], eventCategories: ["Food & Drink"] },
  coffee: { spotTypes: ["coffee_shop"], eventCategories: ["Food & Drink"] },
  music: { spotTypes: ["music_venue"], eventCategories: ["Music"] },
  arts: { spotTypes: ["gallery", "museum", "theater", "studio"], eventCategories: ["Art", "Theater", "Film"] },
  fun: { spotTypes: ["games", "arcade", "karaoke", "eatertainment", "attraction"], eventCategories: ["Comedy", "Sports", "Family"] },
};

function filterItemsByCategory(items: AroundMeItem[], category: FilterCategory): AroundMeItem[] {
  if (category === "all") return items;
  const filter = CLIENT_CATEGORY_FILTERS[category];
  if (!filter) return items;
  return items.filter((item) => {
    if (item.type === "spot") {
      const spot = item.data as AroundMeSpot;
      return spot.venue_type ? filter.spotTypes.includes(spot.venue_type) : false;
    }
    const event = item.data as AroundMeEvent;
    return event.category ? filter.eventCategories.includes(event.category) : false;
  });
}

// Dynamically import map component
const MapViewWrapper = dynamic(() => import("@/components/MapViewWrapper"), { ssr: false });

const NEARBY_RADIUS_MILES = 2;
const DEFAULT_RADIUS_MILES = 5;
const REFRESH_INTERVAL_MS = 60 * 1000;

type UserLocation = { lat: number; lng: number } | null;

export default function WhatsOpenPage() {
  const { portal } = usePortal();
  const [userLocation, setUserLocation] = useState<UserLocation>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>("all");
  const [items, setItems] = useState<AroundMeItem[]>([]);
  const [counts, setCounts] = useState<{ spots: number; events: number; total: number }>({ spots: 0, events: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const isInitialFetch = useRef(true);

  // Check if location was previously granted
  useEffect(() => {
    const savedLocation = localStorage.getItem("userLocation");
    if (savedLocation) {
      try {
        const loc = JSON.parse(savedLocation);
        setUserLocation(loc);
      } catch {
        // ignore
      }
    }
  }, []);

  // Fetch around-me data
  useEffect(() => {
    const abortController = new AbortController();

    async function fetchAroundMe() {
      if (isInitialFetch.current) {
        setLoading(true);
      }
      try {
        const params = new URLSearchParams();
        if (userLocation) {
          params.set("lat", userLocation.lat.toString());
          params.set("lng", userLocation.lng.toString());
        }
        if (selectedNeighborhood) {
          params.set("neighborhood", selectedNeighborhood);
        }
        if (userLocation && !selectedNeighborhood) {
          params.set("radius", NEARBY_RADIUS_MILES.toString());
        } else if (selectedNeighborhood) {
          const hood = getNeighborhoodByName(selectedNeighborhood);
          const radiusMiles = hood ? Math.max((hood.radius / 1609.34) * 1.5, 1) : DEFAULT_RADIUS_MILES;
          params.set("radius", radiusMiles.toFixed(1));
        }
        params.set("limit", "200");

        const res = await fetch(`/api/around-me?${params}`, {
          signal: abortController.signal,
        });
        if (!res.ok) {
          throw new Error(`API returned ${res.status}`);
        }
        const data = await res.json();
        setItems(data.items || []);
        setCounts(data.counts || { spots: 0, events: 0, total: 0 });
        setFetchError(false);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Error fetching around-me data:", error);
        // Only show error on initial load; on background refresh keep stale data
        if (isInitialFetch.current) {
          setItems([]);
          setCounts({ spots: 0, events: 0, total: 0 });
          setFetchError(true);
        }
      } finally {
        setLoading(false);
        isInitialFetch.current = false;
      }
    }

    fetchAroundMe();
    const interval = setInterval(fetchAroundMe, REFRESH_INTERVAL_MS);
    return () => {
      abortController.abort();
      clearInterval(interval);
    };
  }, [userLocation, selectedNeighborhood, retryCount]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationDenied(true);
      return;
    }
    setLocationLoading(true);
    setLocationDenied(false);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(loc);
        localStorage.setItem("userLocation", JSON.stringify(loc));
        setLocationLoading(false);
        setSelectedNeighborhood(null); // Clear neighborhood filter when GPS acquired
      },
      () => {
        setLocationLoading(false);
        setLocationDenied(true);
      }
    );
  }, []);

  const filteredItems = useMemo(() => filterItemsByCategory(items, selectedCategory), [items, selectedCategory]);

  const { mapEvents, mapSpots } = useMemo(() => {
    if (!showMap) return { mapEvents: [], mapSpots: [] };

    type MapEvent = import("@/lib/search").EventWithLocation;
    type MapSpot = import("@/lib/spots").Spot;
    const events: MapEvent[] = [];
    const spots: MapSpot[] = [];

    for (const item of filteredItems) {
      if (item.type === "event") {
        const d = item.data as AroundMeEvent;
        events.push({
          id: d.id, title: d.title, description: null, slug: d.slug,
          start_time: d.start_time, end_time: d.end_time,
          start_date: d.start_time?.split("T")[0] || "", end_date: null,
          is_all_day: d.is_all_day, category: d.category, category_id: null,
          tags: null, genres: null, is_free: d.is_free,
          price_min: d.price_min, price_max: d.price_max, price_note: null,
          ticket_url: d.ticket_url, image_url: null, source_url: "", is_live: true,
          venue: d.venue ? {
            id: d.venue.id, name: d.venue.name, slug: d.venue.slug,
            address: null, neighborhood: d.venue.neighborhood,
            city: "", state: "", lat: d.lat, lng: d.lng,
            typical_price_min: null, typical_price_max: null,
          } : null,
          category_data: null,
        } as MapEvent);
      } else {
        const d = item.data as AroundMeSpot;
        spots.push({
          id: d.id, name: d.name, slug: d.slug, address: d.address,
          neighborhood: d.neighborhood, city: "", state: "",
          lat: d.lat, lng: d.lng, venue_type: d.venue_type,
          venue_types: d.venue_types, description: null,
          short_description: null, price_level: d.price_level,
          website: null, instagram: null, hours_display: null,
          vibes: d.vibes, genres: null, claimed_by: null,
          is_verified: null, image_url: d.image_url,
          featured: false, active: true,
        });
      }
    }
    return { mapEvents: events, mapSpots: spots };
  }, [filteredItems, showMap]);

  const neighborhoodCenter = useMemo(() => {
    if (!selectedNeighborhood) return null;
    const hood = getNeighborhoodByName(selectedNeighborhood);
    if (!hood) return null;
    return { lat: hood.lat, lng: hood.lng, radius: hood.radius };
  }, [selectedNeighborhood]);

  const hasGps = userLocation !== null;

  const modeLabel = useMemo(() => {
    if (selectedNeighborhood) return selectedNeighborhood;
    if (userLocation) return `within ${NEARBY_RADIUS_MILES}mi`;
    return "All of Atlanta";
  }, [selectedNeighborhood, userLocation]);

  // Counts based on filtered items (instant, matches what's displayed)
  const displayCounts = useMemo(() => {
    if (selectedCategory === "all") return counts;
    let events = 0;
    let spots = 0;
    for (const item of filteredItems) {
      if (item.type === "event") events++;
      else spots++;
    }
    return { events, spots, total: events + spots };
  }, [filteredItems, selectedCategory, counts]);

  const dayPart = getDayPart();
  const greeting = getHappeningNowGreeting(dayPart, displayCounts.events, displayCounts.spots, hasGps);

  return (
    <div className="min-h-screen bg-[var(--void)]">
      <PortalHeader portalSlug={portal.slug} portalName={portal.name} />

      {/* Sticky filter bar */}
      <div className="sticky top-[52px] z-20 bg-[var(--night)]/95 backdrop-blur-sm border-b border-[var(--twilight)]/50">
        <div className="max-w-3xl mx-auto px-4 py-2 space-y-2">
          <div className="flex items-center gap-2">
            <select
              value={selectedNeighborhood || ""}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedNeighborhood(val || null);
              }}
              className="flex-1 max-w-[200px] px-3 py-1.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--coral)] transition-colors appearance-none cursor-pointer select-chevron-md"
            >
              <option value="">All of Atlanta</option>
              {NEIGHBORHOOD_NAMES.map((hood) => (
                <option key={hood} value={hood}>{hood}</option>
              ))}
            </select>

            {/* GPS button */}
            <button
              onClick={requestLocation}
              disabled={locationLoading}
              className={`p-1.5 rounded-lg border transition-colors ${
                userLocation
                  ? "border-[var(--neon-green)]/50 bg-[var(--neon-green)]/10 text-[var(--neon-green)]"
                  : "border-[var(--twilight)] bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
              title={userLocation ? "Using your location" : "Use my location"}
            >
              <Crosshair weight={userLocation ? "fill" : "regular"} className={`w-4 h-4 ${locationLoading ? "animate-spin" : ""}`} />
            </button>

            {locationDenied && (
              <span className="font-mono text-[0.6rem] text-[var(--neon-red)]/80">
                Location denied
              </span>
            )}

            {/* Map toggle */}
            <button
              onClick={() => setShowMap((v) => !v)}
              className={`p-1.5 rounded-lg border transition-colors ${
                showMap
                  ? "border-[var(--coral)]/50 bg-[var(--coral)]/10 text-[var(--coral)]"
                  : "border-[var(--twilight)] bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
              title={showMap ? "Hide map" : "Show map"}
            >
              <MapTrifold weight={showMap ? "fill" : "regular"} className="w-4 h-4" />
            </button>
          </div>

          <CategoryFilterChips
            selected={selectedCategory}
            onChange={setSelectedCategory}
          />
        </div>
      </div>

      {/* Map — lazy */}
      {showMap && (
        <div className="max-w-3xl mx-auto px-4 pt-3">
          <div className="h-[35vh] sm:h-[400px] rounded-xl overflow-hidden border border-[var(--twilight)]">
            <MapViewWrapper
              events={mapEvents}
              spots={mapSpots}
              userLocation={userLocation}
              viewRadius={userLocation && !selectedNeighborhood ? NEARBY_RADIUS_MILES : undefined}
              centerPoint={neighborhoodCenter}
              fitAllMarkers={!userLocation && !selectedNeighborhood}
            />
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-4">
        {loading ? (
          <div className="space-y-4">
            {/* Summary skeleton */}
            <div className="animate-pulse">
              <div className="h-6 w-32 bg-[var(--dusk)] rounded mb-2" />
              <div className="h-4 w-56 bg-[var(--dusk)] rounded mb-4" />
              <div className="flex gap-3 mb-4">
                <div className="h-16 flex-1 bg-[var(--dusk)] rounded-xl" />
                <div className="h-16 flex-1 bg-[var(--dusk)] rounded-xl" />
              </div>
            </div>
            <div className="border-t border-[var(--twilight)]/40" />
            {/* Cluster header skeletons */}
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse py-3">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-28 bg-[var(--dusk)] rounded" />
                  <div className="h-3 w-16 bg-[var(--dusk)] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : fetchError ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--neon-red)]/10 flex items-center justify-center">
              <WarningCircle weight="thin" className="w-8 h-8 text-[var(--neon-red)]/60" />
            </div>
            <h2 className="text-lg text-[var(--cream)] mb-2">Couldn&apos;t load what&apos;s happening</h2>
            <p className="text-[var(--muted)] text-sm max-w-xs mx-auto mb-4">
              Something went wrong fetching nearby spots and events.
            </p>
            <button
              onClick={() => {
                isInitialFetch.current = true;
                setFetchError(false);
                setRetryCount((c) => c + 1);
              }}
              className="inline-block px-4 py-2 bg-[var(--twilight)]/30 rounded-lg font-mono text-sm text-[var(--cream)] hover:bg-[var(--twilight)]/50 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
              <Clock weight="thin" className="w-8 h-8 text-[var(--muted)]" />
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
            {/* Summary header */}
            <div className="mb-4">
              <h2 className="text-lg font-medium text-[var(--cream)]">
                {greeting.headline}
              </h2>
              <p className="text-sm text-[var(--muted)] mt-0.5">
                {greeting.subtitle}
              </p>

              {/* Stat cards */}
              <div className="flex gap-3 mt-3">
                {displayCounts.events > 0 && (
                  <div className="flex-1 px-3 py-2.5 rounded-xl border border-[var(--neon-red)]/20 bg-[var(--neon-red)]/5">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--neon-red)] opacity-40" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--neon-red)]" />
                      </span>
                      <span className="font-mono text-xl font-semibold text-[var(--cream)]">{displayCounts.events}</span>
                    </div>
                    <span className="font-mono text-xs text-[var(--muted)] mt-0.5">
                      {displayCounts.events === 1 ? "event live" : "events live"}
                    </span>
                  </div>
                )}
                <div className="flex-1 px-3 py-2.5 rounded-xl border border-[var(--neon-green)]/20 bg-[var(--neon-green)]/5">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--neon-green)]" />
                    </span>
                    <span className="font-mono text-xl font-semibold text-[var(--cream)]">{displayCounts.spots}</span>
                  </div>
                  <span className="font-mono text-xs text-[var(--muted)] mt-0.5">
                    {displayCounts.spots === 1 ? "spot open" : "spots open"}
                  </span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-[var(--twilight)]/40 mb-2" />

            {/* Distance-sorted list */}
            <div className="space-y-2 pt-1">
              {filteredItems.map((item, index) => (
                <AroundMeCard
                  key={`${item.type}-${item.id}`}
                  item={item}
                  index={index}
                  portalSlug={portal.slug}
                  showDistance={hasGps}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
