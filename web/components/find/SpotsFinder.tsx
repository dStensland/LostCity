"use client";

import { Suspense, useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PortalSpotsView from "@/components/PortalSpotsView";
import MapViewWrapper from "@/components/MapViewWrapper";
import { MapErrorBoundary } from "@/components/map/MapErrorBoundary";
import { useMapSpots } from "@/lib/hooks/useMapSpots";
import { useViewportFilter } from "@/lib/hooks/useViewportFilter";
import { useMapLocation } from "@/lib/hooks/useMapLocation";
import { VENUE_CATEGORY_PRESETS } from "@/lib/spots-constants";

type DisplayMode = "list" | "map";

const MAP_DESKTOP_HEIGHT = "clamp(460px, calc(100dvh - 290px), 900px)";
const MAP_MOBILE_HEIGHT = "clamp(340px, calc(100dvh - 250px - env(safe-area-inset-bottom, 0px)), 700px)";

const mapTypePresets = [
  { value: "all", label: "All Types" },
  ...VENUE_CATEGORY_PRESETS.map(({ label, types }) => ({
    value: types.join(","),
    label,
  })),
];

interface SpotsFinderProps {
  portalId: string;
  portalSlug: string;
  portalExclusive: boolean;
  displayMode: DisplayMode;
}

// ─── Destinations Map Filter Bar ──────────────────────────────────────────────

function DestinationsMapFilterBar({ portalSlug }: { portalSlug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(searchParams?.get("search") || "");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchValue = searchParams?.get("search") || "";
  const openNow = searchParams?.get("open_now") === "true";
  const withEvents = searchParams?.get("with_events") === "true";
  const venueType = searchParams?.get("venue_type") || "all";
  const hasMapFilters = Boolean(searchValue || openNow || withEvents || (venueType && venueType !== "all"));

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams?.toString() || "");

      Object.entries(updates).forEach(([key, value]) => {
        if (!value) params.delete(key);
        else params.set(key, value);
      });

      params.set("view", "places");
      params.delete("type");
      params.set("display", "map");

      router.replace(`/${portalSlug}?${params.toString()}`, { scroll: false });
    },
    [portalSlug, router, searchParams]
  );

  useEffect(() => {
    setSearchDraft(searchValue);
  }, [searchValue]);

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      const normalized = searchDraft.trim();
      const nextValue = normalized.length > 0 ? normalized : "";
      if (nextValue === searchValue) return;
      updateParams({ search: nextValue || null });
    }, 280);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchDraft, searchValue, updateParams]);

  return (
    <div className="mt-2 pt-2 border-t border-[var(--twilight)]/60">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <input
            type="text"
            placeholder="Search spots..."
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            className="w-full h-11 pl-8 pr-8 rounded-xl bg-[var(--dusk)]/90 border border-[var(--twilight)]/80 text-[var(--cream)] font-mono text-xs placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)] focus:ring-2 focus:ring-[var(--coral)]/30 transition-colors"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchDraft && (
            <button
              onClick={() => setSearchDraft("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
              aria-label="Clear search"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <select
          value={venueType}
          onChange={(event) => updateParams({ venue_type: event.target.value === "all" ? null : event.target.value })}
          className="h-9 min-w-[120px] max-w-[180px] px-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-xs focus:outline-none focus:border-[var(--coral)] transition-colors appearance-none cursor-pointer select-chevron-md"
        >
          {mapTypePresets.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </select>

        <button
          onClick={() => updateParams({ open_now: openNow ? null : "true" })}
          aria-pressed={openNow}
          className={`h-9 min-h-[44px] px-3 rounded-full border font-mono text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--void)] ${
            openNow
              ? "bg-[var(--neon-green)]/18 border-[var(--neon-green)]/60 text-[var(--neon-green)]"
              : "bg-[var(--dusk)] border-[var(--twilight)] text-[var(--soft)] hover:text-[var(--cream)]"
          }`}
        >
          Open now
        </button>

        <button
          onClick={() => updateParams({ with_events: withEvents ? null : "true" })}
          aria-pressed={withEvents}
          className={`h-9 min-h-[44px] px-3 rounded-full border font-mono text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]/70 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--void)] ${
            withEvents
              ? "bg-[var(--coral)]/20 border-[var(--coral)]/60 text-[var(--coral)]"
              : "bg-[var(--dusk)] border-[var(--twilight)] text-[var(--soft)] hover:text-[var(--cream)]"
          }`}
        >
          Has events
        </button>

        {hasMapFilters && (
          <button
            onClick={() =>
              updateParams({
                search: null,
                venue_type: null,
                open_now: null,
                with_events: null,
              })
            }
            className="h-9 px-2.5 rounded-lg font-mono text-[11px] text-[var(--coral)] hover:text-[var(--rose)] transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ─── SpotsFinder Component ────────────────────────────────────────────────────

export default function SpotsFinder({
  portalId,
  portalSlug,
  portalExclusive,
  displayMode,
}: SpotsFinderProps) {
  const searchParams = useSearchParams();

  // ─── Shared location state ─────────────────────────────────────────────
  const loc = useMapLocation(portalSlug);

  // ─── Map data hooks ──────────────────────────────────────────────────────
  const isMapMode = displayMode === "map";

  const { spots: mapSpots, isFetching: mapSpotsFetching } = useMapSpots({
    portalId,
    portalExclusive,
    enabled: isMapMode,
  });

  const { spotsInView, handleBoundsChange } = useViewportFilter({
    events: [],
    spots: isMapMode ? mapSpots : [],
  });

  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<number | null>(null);

  const handleItemSelect = useCallback((item: { type: "event" | "spot"; id: number } | null) => {
    setSelectedItemId(item?.id ?? null);
  }, []);

  const handleItemHover = useCallback((id: number | null) => {
    setHoveredItemId(id);
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      {/* List mode */}
      {displayMode === "list" && (
        <Suspense fallback={<div className="py-16 text-center text-[var(--muted)]">Loading spots...</div>}>
          <PortalSpotsView
            portalId={portalId}
            portalSlug={portalSlug}
            isExclusive={portalExclusive}
          />
        </Suspense>
      )}

      {/* Map mode */}
      {displayMode === "map" && (
        <div className="relative z-0 -mx-4 mb-3 border border-[var(--twilight)]/85 bg-[var(--void)]/65 shadow-[0_18px_40px_rgba(0,0,0,0.28)] xl:mx-0 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-[var(--twilight)]/75 bg-gradient-to-b from-[var(--night)]/95 to-[var(--void)]/84 backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <svg className="w-4 h-4 text-[var(--muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <select
                  value={loc.locationSelectorValue}
                  onChange={(e) => loc.handleLocationChange(e.target.value)}
                  className="min-w-[176px] max-w-[240px] h-9 px-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-xs focus:outline-none focus:border-[var(--coral)] transition-colors appearance-none cursor-pointer select-chevron-md"
                >
                  <option value="all">All Atlanta</option>
                  <option value="nearby">{loc.locationLoading ? "Locating..." : loc.userLocation ? "Nearby" : "Use my location"}</option>
                  <optgroup label="Neighborhoods">
                    {loc.neighborhoodNames.map((hood) => (
                      <option key={hood} value={hood}>{hood}</option>
                    ))}
                  </optgroup>
                </select>
                {loc.locationLoading && (
                  <div className="w-4 h-4 rounded-full border-2 border-[var(--coral)] border-t-transparent animate-spin flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                {mapSpotsFetching && (
                  <div className="w-3 h-3 rounded-full border-2 border-[var(--coral)] border-t-transparent animate-spin" />
                )}
                <span className="font-mono text-[11px] text-[var(--soft)] whitespace-nowrap">
                  <span className="text-[var(--cream)] font-semibold">{spotsInView.length}</span> shown
                  <span className="text-[var(--muted)]"> / {mapSpots.length} total</span>
                </span>
              </div>
            </div>
            <DestinationsMapFilterBar portalSlug={portalSlug} />
          </div>
          <div style={{ height: MAP_DESKTOP_HEIGHT }}>
            <MapErrorBoundary listHref={`/${portalSlug}?view=places`}>
              <MapViewWrapper
                portalId={portalId}
                portalExclusive={portalExclusive}
                spots={mapSpots}
                isFetching={mapSpotsFetching}
                userLocation={loc.isNearbyMode ? loc.userLocation : undefined}
                viewRadius={loc.isNearbyMode ? 1 : undefined}
                centerPoint={loc.mapCenterPoint}
                fitAllMarkers={loc.shouldFitAll}
                onBoundsChange={handleBoundsChange}
                selectedItemId={selectedItemId}
                hoveredItemId={hoveredItemId}
                onItemSelect={handleItemSelect}
              />
            </MapErrorBoundary>
          </div>
        </div>
      )}
    </>
  );
}
