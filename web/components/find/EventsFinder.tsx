"use client";

import { Suspense, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FindFilterBar from "@/components/find/FindFilterBar";
import FindSearchInput from "@/components/find/FindSearchInput";
import { PreSearchState } from "@/components/search";
import type { PreSearchPayload } from "@/lib/search-presearch";
import { TRENDING_SEARCHES } from "@/lib/search-presearch";
import EventList from "@/components/EventList";
import MapViewWrapper from "@/components/MapViewWrapper";
import CalendarView from "@/components/CalendarView";
import MobileCalendarView from "@/components/calendar/MobileCalendarView";
import { ActiveFiltersRow } from "@/components/filters";
import { useMapEvents } from "@/lib/hooks/useMapEvents";
import { useViewportFilter } from "@/lib/hooks/useViewportFilter";
import { useMapLocation } from "@/lib/hooks/useMapLocation";
import MapListDrawer from "@/components/map/MapListDrawer";
import MapBottomSheet from "@/components/map/MapBottomSheet";
import MapDatePills from "@/components/map/MapDatePills";
import { MapErrorBoundary } from "@/components/map/MapErrorBoundary";

type DisplayMode = "list" | "map" | "calendar";

const MAP_DESKTOP_HEIGHT = "clamp(460px, calc(100dvh - 290px), 900px)";
const MAP_MOBILE_HEIGHT = "clamp(340px, calc(100dvh - 250px - env(safe-area-inset-bottom, 0px)), 700px)";

interface EventsFinderProps {
  portalId: string;
  portalSlug: string;
  portalExclusive: boolean;
  displayMode: DisplayMode;
  hasActiveFilters: boolean;
  vertical?: string | null;
}

/**
 * Inner implementation of EventsFinderFilters — needs access to URL params
 * (useSearchParams) so it lives inside the Suspense boundary.
 */
function EventsFinderFiltersInner({
  portalId,
  portalSlug,
  portalExclusive,
  displayMode,
  hasActiveFilters,
  vertical,
}: EventsFinderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSearch = searchParams?.get("search") || "";

  // Pre-search state — populated via callback from FindSearchInput
  const [preSearchData, setPreSearchData] = useState<PreSearchPayload>({
    trending: TRENDING_SEARCHES,
    popularNow: [],
  });
  const [preSearchLoading, setPreSearchLoading] = useState(false);

  const handlePreSearchChange = useCallback(
    (data: PreSearchPayload | null, loading: boolean) => {
      if (data) setPreSearchData(data);
      setPreSearchLoading(loading);
    },
    []
  );

  // Show PreSearchState when no URL search is active (query empty) and we're
  // not in map mode (where space is at a premium).
  const showPreSearch = !urlSearch && displayMode !== "map";

  return (
    <div className="mt-2.5 pt-2.5 border-t border-[var(--twilight)]/65">
      {/* Search input with typeahead */}
      <div className="mb-3">
        <FindSearchInput
          portalSlug={portalSlug}
          portalId={portalId}
          findType="events"
          placeholder="Search events..."
          onPreSearchChange={handlePreSearchChange}
        />
      </div>

      {/* Pre-search discovery state — trending pills + popular events.
          Rendered as SIBLING of FindSearchInput (not inside the dropdown). */}
      {showPreSearch && (
        <div className="mb-3">
          <PreSearchState
            trending={preSearchData.trending}
            popularNow={preSearchData.popularNow}
            onTrendingClick={(term) => {
              // Clicking a trending pill sets it as a URL search param.
              // FindSearchInput's URL→query sync effect picks this up automatically.
              const params = new URLSearchParams(searchParams?.toString() || "");
              params.set("search", term);
              params.delete("page");
              router.push(`/${portalSlug}?${params.toString()}`, { scroll: false });
            }}
            portalSlug={portalSlug}
            layout="wrap"
            loading={preSearchLoading && preSearchData.popularNow.length === 0}
          />
        </div>
      )}

      <FindFilterBar
        variant={displayMode === "map" ? "compact" : "full"}
        hideDate={displayMode === "calendar"}
        portalId={portalId}
        portalExclusive={portalExclusive}
        portalSlug={portalSlug}
        vertical={vertical}
      />
      {/* Active Filters */}
      {hasActiveFilters && displayMode === "list" && (
        <div className="px-1 pt-2">
          <ActiveFiltersRow />
        </div>
      )}
    </div>
  );
}

/**
 * Events filter bar section — rendered inside FindShell's control panel.
 */
export function EventsFinderFilters({
  portalId,
  portalSlug,
  portalExclusive,
  displayMode,
  hasActiveFilters,
  vertical,
}: EventsFinderProps) {
  return (
    <Suspense fallback={<div className="h-10 bg-[var(--night)] rounded-xl mt-3" />}>
      <EventsFinderFiltersInner
        portalId={portalId}
        portalSlug={portalSlug}
        portalExclusive={portalExclusive}
        displayMode={displayMode}
        hasActiveFilters={hasActiveFilters}
        vertical={vertical}
      />
    </Suspense>
  );
}

/**
 * Events content area — list, calendar, or map display modes.
 */
export default function EventsFinder({
  portalId,
  portalSlug,
  portalExclusive,
  displayMode,
  hasActiveFilters,
}: EventsFinderProps) {
  const searchParams = useSearchParams();

  // ─── Shared location state (map-specific) ──────────────────────────────
  const loc = useMapLocation(portalSlug);

  // ─── Map data hooks ──────────────────────────────────────────────────────
  const isMapMode = displayMode === "map";

  const { events: mapEvents, isFetching: mapEventsFetching } = useMapEvents({
    portalId,
    portalExclusive,
    enabled: isMapMode,
    dateOverride: new Date().toISOString().slice(0, 10),
  });

  const { eventsInView, spotsInView, handleBoundsChange } = useViewportFilter({
    events: isMapMode ? mapEvents : [],
    spots: [],
  });
  const mapInViewCount = eventsInView.length;
  const mapTotalCount = mapEvents.length;

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
        <EventList
          hasActiveFilters={hasActiveFilters}
          portalId={portalId}
          portalExclusive={portalExclusive}
          portalSlug={portalSlug}
        />
      )}

      {/* Calendar mode */}
      {displayMode === "calendar" && (
        <Suspense fallback={<div className="py-16 text-center text-[var(--muted)]">Loading calendar...</div>}>
          <div className="lg:hidden">
            <MobileCalendarView
              portalId={portalId}
              portalSlug={portalSlug}
              portalExclusive={portalExclusive}
            />
          </div>
          <div className="hidden lg:block relative z-0 border border-[var(--twilight)]/85 bg-[var(--void)]/65 shadow-[0_18px_40px_rgba(0,0,0,0.28)] overflow-hidden">
            <CalendarView
              portalId={portalId}
              portalSlug={portalSlug}
              portalExclusive={portalExclusive}
              fullBleed
            />
          </div>
        </Suspense>
      )}

      {/* Map mode */}
      {displayMode === "map" && (
        <div
          className="relative z-0 -mx-4 border border-[var(--twilight)]/85 bg-[var(--void)]/65 shadow-[0_18px_40px_rgba(0,0,0,0.28)] xl:mx-0 overflow-hidden"
        >
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
                {mapEventsFetching && (
                  <div className="w-3 h-3 rounded-full border-2 border-[var(--coral)] border-t-transparent animate-spin" />
                )}
                <span className="font-mono text-[11px] text-[var(--soft)] whitespace-nowrap">
                  <span className="text-[var(--cream)] font-semibold">{mapInViewCount}</span> shown
                  <span className="text-[var(--muted)]"> / {mapTotalCount} total</span>
                </span>
              </div>
            </div>
            <div className="mt-2 pt-1.5 border-t border-[var(--twilight)]/60">
              <MapDatePills />
            </div>
          </div>

          {/* Desktop: split-pane */}
          <div className="hidden md:flex" style={{ height: MAP_DESKTOP_HEIGHT }}>
            <div className="w-[clamp(360px,28vw,560px)] flex-shrink-0 border-r border-[var(--twilight)]/90">
              <MapListDrawer
                events={eventsInView}
                spots={spotsInView}
                isLoading={mapEventsFetching}
                selectedItemId={selectedItemId}
                onItemSelect={handleItemSelect}
                onItemHover={handleItemHover}
              />
            </div>
            <div className="flex-1 min-w-0">
              <MapErrorBoundary listHref={`/${portalSlug}?view=happening`}>
                <MapViewWrapper
                  events={mapEvents}
                  portalId={portalId}
                  portalExclusive={portalExclusive}
                  isFetching={mapEventsFetching}
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

          {/* Mobile: full-height map with bottom sheet */}
          <div
            className="md:hidden relative"
            style={{ height: MAP_MOBILE_HEIGHT }}
          >
            <MapErrorBoundary listHref={`/${portalSlug}?view=happening`}>
              <MapViewWrapper
                events={mapEvents}
                portalId={portalId}
                portalExclusive={portalExclusive}
                isFetching={mapEventsFetching}
                showMobileSheet={false}
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
            <MapBottomSheet
              events={eventsInView}
              spots={spotsInView}
              isLoading={mapEventsFetching}
              selectedItemId={selectedItemId}
              onItemSelect={handleItemSelect}
              onItemHover={handleItemHover}
            />
          </div>
        </div>
      )}
    </>
  );
}
