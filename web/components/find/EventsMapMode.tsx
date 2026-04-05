"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useMapEvents } from "@/lib/hooks/useMapEvents";
import { useViewportFilter } from "@/lib/hooks/useViewportFilter";
import { useMapLocation } from "@/lib/hooks/useMapLocation";
import MapListDrawer from "@/components/map/MapListDrawer";
import MapBottomSheet from "@/components/map/MapBottomSheet";
import MapDatePills from "@/components/map/MapDatePills";
import { MapErrorBoundary } from "@/components/map/MapErrorBoundary";
import { buildExploreUrl } from "@/lib/find-url";

const MapViewWrapper = dynamic(() => import("@/components/MapViewWrapper"));

const MAP_DESKTOP_HEIGHT = "clamp(460px, calc(100dvh - 290px), 900px)";
const MAP_MOBILE_HEIGHT =
  "clamp(340px, calc(100dvh - 250px - env(safe-area-inset-bottom, 0px)), 700px)";

interface EventsMapModeProps {
  portalId: string;
  portalSlug: string;
  portalExclusive: boolean;
}

export default function EventsMapMode({
  portalId,
  portalSlug,
  portalExclusive,
}: EventsMapModeProps) {
  const loc = useMapLocation(portalSlug);
  const { events: mapEvents, isFetching: mapEventsFetching } = useMapEvents({
    portalId,
    portalExclusive,
    enabled: true,
    dateOverride: new Date().toISOString().slice(0, 10),
  });

  const { eventsInView, spotsInView, handleBoundsChange } = useViewportFilter({
    events: mapEvents,
    spots: [],
  });
  const mapInViewCount = eventsInView.length;
  const mapTotalCount = mapEvents.length;
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<number | null>(null);

  const handleItemSelect = useCallback(
    (item: { type: "event" | "spot"; id: number } | null) => {
      setSelectedItemId(item?.id ?? null);
    },
    [],
  );

  const handleItemHover = useCallback((id: number | null) => {
    setHoveredItemId(id);
  }, []);

  return (
    <div className="relative z-0 -mx-4 border border-[var(--twilight)]/85 bg-[var(--void)]/65 shadow-[0_18px_40px_rgba(0,0,0,0.28)] xl:mx-0 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-[var(--twilight)]/75 bg-gradient-to-b from-[var(--night)]/95 to-[var(--void)]/84 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <svg className="w-4 h-4 text-[var(--muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <select
              value={loc.locationSelectorValue}
              onChange={(event) => loc.handleLocationChange(event.target.value)}
              className="min-w-[176px] max-w-[240px] h-9 px-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-xs focus:outline-none focus:border-[var(--coral)] transition-colors appearance-none cursor-pointer select-chevron-md"
            >
              <option value="all">All Atlanta</option>
              <option value="nearby">
                {loc.locationLoading
                  ? "Locating..."
                  : loc.userLocation
                    ? "Nearby"
                    : "Use my location"}
              </option>
              <optgroup label="Neighborhoods">
                {loc.neighborhoodNames.map((hood) => (
                  <option key={hood} value={hood}>
                    {hood}
                  </option>
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
          <MapErrorBoundary listHref={buildExploreUrl({ portalSlug, lane: "events" })}>
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

      <div className="md:hidden relative" style={{ height: MAP_MOBILE_HEIGHT }}>
        <MapErrorBoundary listHref={buildExploreUrl({ portalSlug, lane: "events" })}>
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
  );
}
