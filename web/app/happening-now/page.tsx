"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import type { AroundMeItem, AroundMeSpot, AroundMeEvent } from "@/app/api/around-me/route";
import AroundMeCard from "@/components/AroundMeCard";
import CategoryFilterChips, { type FilterCategory } from "@/components/CategoryFilterChips";
import { NEIGHBORHOODS, type Spot } from "@/lib/spots-constants";
import { DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";

// Dynamically import heavy components
const GlassHeader = dynamic(() => import("@/components/GlassHeader"), { ssr: false });
const MainNav = dynamic(() => import("@/components/MainNav"), { ssr: false });
const MapViewWrapper = dynamic(() => import("@/components/MapViewWrapper"), { ssr: false });
const NeighborhoodGrid = dynamic(() => import("@/components/NeighborhoodGrid"), { ssr: false });

// Distance filter for GPS mode (miles) - tight radius for "nearby"
const NEARBY_RADIUS_MILES = 1;

// Refetch interval for freshness (ms)
const REFETCH_INTERVAL = 30_000;

type UserLocation = { lat: number; lng: number } | null;

type AroundMeResponse = {
  items: AroundMeItem[];
  counts: { spots: number; events: number; total: number };
  center: { lat: number; lng: number; usingGps: boolean; neighborhood: string | null };
};

export default function HappeningNowPage() {
  const [userLocation, setUserLocation] = useState<UserLocation>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [, setLocationDenied] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(true);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>("all");
  const [items, setItems] = useState<AroundMeItem[]>([]);
  const [counts, setCounts] = useState<{ spots: number; events: number; total: number }>({ spots: 0, events: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const refetchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if location was previously granted - run before fetching
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
    setInitialized(true);
  }, []);

  // Fetch from unified /api/around-me
  const fetchAroundMe = useCallback(async (signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (userLocation && !selectedNeighborhood) {
      // GPS mode: tight 1-mile radius from user's actual location
      params.set("lat", userLocation.lat.toString());
      params.set("lng", userLocation.lng.toString());
      params.set("radius", String(NEARBY_RADIUS_MILES));
    }
    if (selectedNeighborhood) {
      // Neighborhood mode: filter by neighborhood name, not radius
      params.set("neighborhood", selectedNeighborhood);
    }
    // When neither GPS nor neighborhood, don't set radius - API will return all
    if (selectedCategory !== "all") {
      params.set("category", selectedCategory);
    }
    params.set("limit", "60");
    params.set("portal", DEFAULT_PORTAL_SLUG);

    const res = await fetch(`/api/around-me?${params}`, { signal });
    if (!res.ok) throw new Error("Failed to fetch");
    return (await res.json()) as AroundMeResponse;
  }, [userLocation, selectedNeighborhood, selectedCategory]);

  // Fetch data when params change - wait for initialization
  useEffect(() => {
    if (!initialized) return;

    const abortController = new AbortController();
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const data = await fetchAroundMe(abortController.signal);
        if (mounted) {
          setItems(data.items);
          setCounts(data.counts);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Error fetching around-me:", error);
        if (mounted) {
          setItems([]);
          setCounts({ spots: 0, events: 0, total: 0 });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
      abortController.abort();
    };
  }, [fetchAroundMe, initialized]);

  // Periodic refetch for freshness
  useEffect(() => {
    if (!initialized) return;
    if (refetchTimerRef.current) clearInterval(refetchTimerRef.current);

    refetchTimerRef.current = setInterval(async () => {
      try {
        const data = await fetchAroundMe();
        setItems(data.items);
        setCounts(data.counts);
      } catch {
        // Silent fail on background refetch
      }
    }, REFETCH_INTERVAL);

    return () => {
      if (refetchTimerRef.current) clearInterval(refetchTimerRef.current);
    };
  }, [fetchAroundMe, initialized]);

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

  // Convert AroundMeItems to Spot[] and EventWithLocation[] for the map
  const mapSpots = useMemo(() => {
    return items
      .filter((item): item is AroundMeItem & { type: "spot" } => item.type === "spot")
      .map((item) => {
        const spot = item.data as AroundMeSpot;
        return {
          id: spot.id,
          name: spot.name,
          slug: spot.slug,
          address: spot.address,
          neighborhood: spot.neighborhood,
          city: "Atlanta",
          state: "GA",
          lat: spot.lat,
          lng: spot.lng,
          venue_type: spot.venue_type,
          venue_types: spot.venue_types,
          description: null,
          short_description: null,
          price_level: spot.price_level,
          website: null,
          instagram: null,
          hours_display: null,
          vibes: spot.vibes,
          image_url: spot.image_url,
          featured: false,
        } as Spot;
      });
  }, [items]);

  const mapEvents = useMemo(() => {
    return items
      .filter((item): item is AroundMeItem & { type: "event" } => item.type === "event")
      .map((item) => {
        const event = item.data as AroundMeEvent;
        return {
          id: event.id,
          title: event.title,
          slug: String(event.id),
          start_date: new Date().toISOString().split("T")[0],
          start_time: event.start_time,
          end_time: event.end_time,
          is_all_day: event.is_all_day,
          category: event.category,
          subcategory: event.subcategory,
          is_free: event.is_free,
          is_live: true,
          ticket_url: event.ticket_url,
          venue: event.venue ? {
            id: event.venue.id,
            name: event.venue.name,
            slug: event.venue.slug,
            address: null,
            neighborhood: event.venue.neighborhood,
            city: null,
            state: null,
            lat: event.lat,
            lng: event.lng,
            typical_price_min: null,
            typical_price_max: null,
            spot_type: null,
          } : null,
          category_data: null,
        };
      }) as unknown as import("@/lib/search").EventWithLocation[];
  }, [items]);

  // Extract items for NeighborhoodGrid (needs simple arrays with neighborhood)
  const gridEvents = useMemo(() =>
    items
      .filter((i) => i.type === "event")
      .map((i) => {
        const e = i.data as AroundMeEvent;
        return { venue: e.venue ? { neighborhood: e.venue.neighborhood } : null };
      }),
  [items]);

  const gridSpots = useMemo(() =>
    items
      .filter((i) => i.type === "spot")
      .map((i) => {
        const s = i.data as AroundMeSpot;
        return { neighborhood: s.neighborhood };
      }),
  [items]);

  // Category counts for filter chips
  const categoryCounts = useMemo(() => {
    // We only have total counts from the API, not per-category
    // Show total count on "all" chip
    return { all: counts.total } as Partial<Record<FilterCategory, number>>;
  }, [counts.total]);

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
              Share your location or pick a neighborhood to see what&apos;s open nearby
            </p>
            <div className="space-y-3">
              <button
                onClick={requestLocation}
                disabled={locationLoading}
                className="w-full px-4 py-3 rounded-lg bg-[var(--neon-magenta)] text-[var(--cream)] font-mono text-sm font-medium hover:bg-[var(--neon-magenta)]/80 hover:shadow-[0_0_20px_var(--neon-magenta)/40] transition-all disabled:opacity-50"
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
                className="w-full px-4 py-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm focus:outline-none focus:border-[var(--neon-amber)] transition-colors appearance-none cursor-pointer select-chevron-lg"
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
                Show all of Atlanta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="sticky top-[104px] z-20 bg-[var(--night)]/95 backdrop-blur-sm border-b border-[var(--twilight)]/50">
        <div className="max-w-3xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full bg-[var(--neon-red)] animate-pulse flex-shrink-0 neon-red-glow"
              />
              <span className="font-mono text-xs text-[var(--muted)]">
                {counts.spots} open · {counts.events} live
                {userLocation && !selectedNeighborhood ? (
                  <span className="text-[var(--neon-cyan)]"> (within {NEARBY_RADIUS_MILES}mi)</span>
                ) : selectedNeighborhood ? (
                  <span className="text-[var(--soft)]"> in {selectedNeighborhood}</span>
                ) : null}
              </span>
            </div>

            {/* Neighborhood selector */}
            <div className="flex items-center gap-2">
              <select
                value={selectedNeighborhood || ""}
                onChange={(e) => setSelectedNeighborhood(e.target.value || null)}
                className="px-2 py-1 rounded-md bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-[0.65rem] focus:outline-none focus:border-[var(--neon-amber)] transition-colors appearance-none cursor-pointer select-chevron-sm"
              >
                <option value="">Nearby</option>
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

      {/* Map */}
      <div className="max-w-3xl mx-auto px-4 pt-4">
        <div className="h-[310px] rounded-xl overflow-hidden border border-[var(--twilight)]">
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
            />
          )}
        </div>
      </div>

      {/* Category filter chips */}
      <div className="max-w-3xl mx-auto px-4 pt-4">
        <CategoryFilterChips
          selected={selectedCategory}
          onChange={setSelectedCategory}
          counts={categoryCounts}
        />
      </div>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {loading && items.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse h-[76px] bg-[var(--dusk)] rounded-sm" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg text-[var(--cream)] mb-2">Nothing happening right now</h2>
            <p className="text-[var(--muted)] text-sm max-w-xs mx-auto mb-4">
              {selectedCategory !== "all"
                ? "No results for this category. Try a different filter."
                : userLocation && !selectedNeighborhood
                  ? "No spots open within 1 mile. Try selecting a neighborhood instead."
                  : "Check back later or browse upcoming events"}
            </p>
            <Link
              href={`/${DEFAULT_PORTAL_SLUG}`}
              className="inline-block px-4 py-2 bg-[var(--twilight)]/30 rounded-lg font-mono text-sm text-[var(--cream)] hover:bg-[var(--twilight)]/50 transition-colors"
            >
              Browse events
            </Link>
          </div>
        ) : (
          <div>
            {/* Neon Sign Header */}
            <div className="relative mb-6 py-4">
              <div
                className="absolute inset-0 blur-2xl opacity-20 neon-sign-glow"
              />
              <div className="absolute left-0 right-0 top-0 h-px opacity-30 neon-sign-line" />
              <div className="absolute left-0 right-0 bottom-0 h-px opacity-30 neon-sign-line" />
              <div className="relative flex justify-center">
                <div className="relative">
                  <h2
                    className="absolute inset-0 font-bold text-lg sm:text-xl tracking-[0.2em] uppercase blur-md opacity-60 text-[var(--coral)]"
                    aria-hidden="true"
                  >
                    What&apos;s Open
                  </h2>
                  <h2
                    className="absolute inset-0 font-bold text-lg sm:text-xl tracking-[0.2em] uppercase blur-sm opacity-80 text-[var(--coral)]"
                    aria-hidden="true"
                  >
                    What&apos;s Open
                  </h2>
                  <h2
                    className="relative font-bold text-lg sm:text-xl tracking-[0.2em] uppercase neon-sign-text"
                  >
                    What&apos;s Open
                  </h2>
                </div>
              </div>
            </div>

            {/* Interleaved list sorted by distance */}
            <div className="space-y-2">
              {items.map((item, index) => (
                <AroundMeCard
                  key={`${item.type}-${item.id}`}
                  item={item}
                  index={index}
                />
              ))}
            </div>

            {/* Neighborhood Grid */}
            <div className="mt-8 pt-6 border-t border-[var(--twilight)]/30">
              <h3 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-3">Browse by Neighborhood</h3>
              <NeighborhoodGrid
                neighborhoods={NEIGHBORHOODS}
                events={gridEvents}
                spots={gridSpots}
                selectedNeighborhood={selectedNeighborhood}
                onSelectNeighborhood={setSelectedNeighborhood}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
