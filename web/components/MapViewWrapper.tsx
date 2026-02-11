"use client";

import dynamic from "next/dynamic";
import { useMapEvents } from "@/lib/hooks/useMapEvents";
import type { EventWithLocation } from "@/lib/search";
import type { Spot } from "@/lib/spots-constants";
import type { MapBounds } from "./MapView";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[var(--night)] border border-[var(--twilight)] relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.04] map-grid-lines" />
      <div className="absolute inset-0 skeleton-shimmer" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[var(--dusk)]/80 backdrop-blur-sm border border-[var(--twilight)]">
          <div className="w-4 h-4 rounded-full border-2 border-[var(--coral)] border-t-transparent animate-spin" />
          <span className="text-[var(--muted)] font-mono text-xs">Loading map</span>
        </div>
      </div>
    </div>
  ),
});

interface Props {
  // If events are provided directly, use them (e.g., happening-now page)
  events?: EventWithLocation[];
  // Spots to show as pins (for happening-now page)
  spots?: Spot[];
  userLocation?: { lat: number; lng: number } | null;
  // View radius in miles (for GPS mode) - defaults to fitting all markers
  viewRadius?: number;
  // Optional center point (e.g., neighborhood center) without showing a user marker
  // radius is in meters, used to calculate zoom bounds for the neighborhood
  centerPoint?: { lat: number; lng: number; radius?: number } | null;
  // When true, fit bounds to all markers
  fitAllMarkers?: boolean;
  // If no events provided, fetch using these params
  portalId?: string;
  portalExclusive?: boolean;
  // Loading state — suppress empty overlay when refetching
  isFetching?: boolean;
  // Whether to show MobileMapSheet on pin tap (disable when MapBottomSheet handles it)
  showMobileSheet?: boolean;
  // Drawer integration props
  onBoundsChange?: (bounds: MapBounds) => void;
  selectedItemId?: number | null;
  hoveredItemId?: number | null;
  onItemSelect?: (item: { type: "event" | "spot"; id: number } | null) => void;
}

export default function MapViewWrapper({
  events: providedEvents,
  spots,
  userLocation,
  viewRadius,
  centerPoint,
  fitAllMarkers,
  portalId,
  portalExclusive,
  isFetching: externalFetching,
  showMobileSheet,
  onBoundsChange,
  selectedItemId,
  hoveredItemId,
  onItemSelect,
}: Props) {
  // Only use the hook if events aren't provided directly
  const { events: fetchedEvents, isLoading } = useMapEvents({
    portalId,
    portalExclusive,
    enabled: !providedEvents, // Skip fetching if events are provided
  });

  // Use provided events if available, otherwise use fetched events
  const events = providedEvents || fetchedEvents;
  const loading = !providedEvents && isLoading;

  if (loading && events.length === 0) {
    return (
      <div className="w-full h-full bg-[var(--night)] border border-[var(--twilight)] relative overflow-hidden">
        {/* Skeleton map grid lines */}
        <div className="absolute inset-0 opacity-[0.04] map-grid-lines" />
        {/* Shimmer overlay */}
        <div className="absolute inset-0 skeleton-shimmer" />
        {/* Centered loading indicator */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[var(--dusk)]/80 backdrop-blur-sm border border-[var(--twilight)]">
            <div className="w-4 h-4 rounded-full border-2 border-[var(--coral)] border-t-transparent animate-spin" />
            <span className="text-[var(--muted)] font-mono text-xs">Loading events</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MapView
      events={events}
      spots={spots}
      userLocation={userLocation}
      viewRadius={viewRadius}
      centerPoint={centerPoint}
      fitAllMarkers={fitAllMarkers}
      isFetching={externalFetching || loading}
      showMobileSheet={showMobileSheet}
      onBoundsChange={onBoundsChange}
      selectedItemId={selectedItemId}
      hoveredItemId={hoveredItemId}
      onItemSelect={onItemSelect}
    />
  );
}
