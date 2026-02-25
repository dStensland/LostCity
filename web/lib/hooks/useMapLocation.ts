"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getNeighborhoodByName, NEIGHBORHOOD_NAMES } from "@/config/neighborhoods";

type LocationMode = "all" | "nearby" | string;

interface MapLocationState {
  locationMode: LocationMode;
  userLocation: { lat: number; lng: number } | null;
  locationLoading: boolean;
  locationSelectorValue: string;
  neighborhoodFilter: string;
  mapCenterPoint: { lat: number; lng: number; radius: number } | null;
  isNearbyMode: boolean;
  isNeighborhoodMode: boolean;
  shouldFitAll: boolean;
  neighborhoodNames: readonly string[];
  handleLocationChange: (value: string) => void;
}

/**
 * Shared location state for map views (Events + Destinations).
 *
 * Consolidates the identical location-mode / neighborhood / geolocation
 * logic that was duplicated in EventsFinder and SpotsFinder.
 */
export function useMapLocation(portalSlug: string): MapLocationState {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = `/${portalSlug}`;

  const [locationMode, setLocationMode] = useState<LocationMode>("all");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem("userLocation");
    if (!saved) return null;
    try {
      return JSON.parse(saved) as { lat: number; lng: number };
    } catch {
      return null;
    }
  });
  const [locationLoading, setLocationLoading] = useState(false);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(loc);
        localStorage.setItem("userLocation", JSON.stringify(loc));
        setLocationLoading(false);
      },
      () => {
        setLocationLoading(false);
        setLocationMode("all");
      }
    );
  }, []);

  const handleLocationChange = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");

    if (value === "nearby") {
      setLocationMode("nearby");
      params.delete("neighborhoods");
      if (!userLocation) requestLocation();
    } else if (value === "all") {
      setLocationMode("all");
      params.delete("neighborhoods");
    } else {
      setLocationMode(value);
      params.set("neighborhoods", value);
    }

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, pathname, router, userLocation, requestLocation]);

  const neighborhoodFilter = searchParams?.get("neighborhoods") || "";
  const mapCenterPoint = useMemo(() => {
    const hoods = neighborhoodFilter.split(",").filter(Boolean);
    if (hoods.length === 1) {
      const hood = getNeighborhoodByName(hoods[0]);
      if (hood) {
        return { lat: hood.lat, lng: hood.lng, radius: hood.radius };
      }
    }
    return null;
  }, [neighborhoodFilter]);

  const isNearbyMode = locationMode === "nearby" && !!userLocation;
  const isNeighborhoodMode = !!mapCenterPoint;
  const shouldFitAll = !isNearbyMode && !isNeighborhoodMode;

  const locationSelectorValue = useMemo(() => {
    if (locationMode === "nearby") return "nearby";
    const hoods = neighborhoodFilter.split(",").filter(Boolean);
    return hoods.length === 1 ? hoods[0] : "all";
  }, [locationMode, neighborhoodFilter]);

  return {
    locationMode,
    userLocation,
    locationLoading,
    locationSelectorValue,
    neighborhoodFilter,
    mapCenterPoint,
    isNearbyMode,
    isNeighborhoodMode,
    shouldFitAll,
    neighborhoodNames: NEIGHBORHOOD_NAMES,
    handleLocationChange,
  };
}
