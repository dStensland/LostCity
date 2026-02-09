"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { EventWithLocation } from "@/lib/search";
import type { Spot } from "@/lib/spots-constants";
import type { MapBounds } from "@/components/MapView";

interface UseViewportFilterOptions {
  events: EventWithLocation[];
  spots: Spot[];
  debounceMs?: number;
}

function isInBounds(lat: number | null, lng: number | null, bounds: MapBounds | null): boolean {
  if (!bounds || lat == null || lng == null) return false;
  return (
    lat >= bounds.south &&
    lat <= bounds.north &&
    lng >= bounds.west &&
    lng <= bounds.east
  );
}

export function useViewportFilter({ events, spots, debounceMs = 150 }: UseViewportFilterOptions) {
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleBoundsChange = useCallback(
    (newBounds: MapBounds) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setBounds(newBounds), debounceMs);
    },
    [debounceMs]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const eventsInView = useMemo(
    () =>
      bounds
        ? events.filter((e) => isInBounds(e.venue?.lat ?? null, e.venue?.lng ?? null, bounds))
        : events,
    [events, bounds]
  );

  const spotsInView = useMemo(
    () =>
      bounds
        ? spots.filter((s) => isInBounds(s.lat, s.lng, bounds))
        : spots,
    [spots, bounds]
  );

  return { eventsInView, spotsInView, bounds, handleBoundsChange };
}
