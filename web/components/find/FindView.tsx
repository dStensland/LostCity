"use client";

import { Suspense, useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FindFilterBar from "@/components/find/FindFilterBar";
import EventList from "@/components/EventList";
import MapViewWrapper from "@/components/MapViewWrapper";
import CalendarView from "@/components/CalendarView";
import MobileCalendarView from "@/components/calendar/MobileCalendarView";
import PortalSpotsView from "@/components/PortalSpotsView";
import ClassesView from "@/components/find/ClassesView";
import { ActiveFiltersRow } from "@/components/filters";
import AddNewChooser from "@/components/find/AddNewChooser";
import { getNeighborhoodByName, NEIGHBORHOOD_NAMES } from "@/config/neighborhoods";
import { useMapEvents } from "@/lib/hooks/useMapEvents";
import { useViewportFilter } from "@/lib/hooks/useViewportFilter";
import MapListDrawer from "@/components/map/MapListDrawer";
import MapBottomSheet from "@/components/map/MapBottomSheet";
import MapDatePills from "@/components/map/MapDatePills";

type FindType = "events" | "classes" | "destinations";
type DisplayMode = "list" | "map" | "calendar";
type ListDensity = "comfortable" | "compact";

const MAP_DESKTOP_HEIGHT = "clamp(460px, calc(100dvh - 290px), 900px)";
const MAP_MOBILE_HEIGHT = "clamp(340px, calc(100dvh - 250px - env(safe-area-inset-bottom, 0px)), 700px)";
const DESTINATIONS_MAP_HEIGHT = "clamp(420px, calc(100dvh - 280px), 860px)";

interface FindViewProps {
  portalId: string;
  portalSlug: string;
  portalExclusive: boolean;
  findType: FindType;
  displayMode: DisplayMode;
  hasActiveFilters: boolean;
}

const TYPE_OPTIONS: { key: FindType; label: string; icon: React.ReactNode }[] = [
  {
    key: "events",
    label: "Events",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: "classes",
    label: "Classes",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    key: "destinations",
    label: "Destinations",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const DISPLAY_OPTIONS: Record<DisplayMode, { label: string; shortLabel: string; icon: React.ReactNode }> = {
  list: {
    label: "List",
    shortLabel: "List",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  calendar: {
    label: "Calendar",
    shortLabel: "Cal",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  map: {
    label: "Map",
    shortLabel: "Map",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
};

function FindViewInner({
  portalId,
  portalSlug,
  portalExclusive,
  findType,
  displayMode,
  hasActiveFilters,
}: FindViewProps) {
  const viewRootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [eventSearch, setEventSearch] = useState(searchParams?.get("search") || "");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pathname = `/${portalSlug}`;

  // Location selector state (map-specific)
  type LocationMode = "all" | "nearby" | string; // string = neighborhood name
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
      // Neighborhood selected
      setLocationMode(value);
      params.set("neighborhoods", value);
    }

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, pathname, router, userLocation, requestLocation]);

  const updateSearchParam = (value: string) => {
    setEventSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      if (value) {
        params.set("search", value);
      } else {
        params.delete("search");
      }
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }, 300);
  };

  // Derive map zoom props from location mode
  const neighborhoodFilter = searchParams?.get("neighborhoods") || "";
  const mapCenterPoint = useMemo(() => {
    // If exactly one neighborhood is selected, zoom to it
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

  // ─── Drawer state for map modes ───────────────────────────────────────────
  const isMapMode = displayMode === "map" && (findType === "events" || findType === "destinations");

  // Lift useMapEvents for events map mode so we can pass events to both map and drawer
  const { events: mapEvents, isFetching: mapEventsFetching } = useMapEvents({
    portalId,
    portalExclusive,
    enabled: isMapMode && findType === "events",
  });

  // Viewport filter for drawer
  const { eventsInView, spotsInView, handleBoundsChange } = useViewportFilter({
    events: isMapMode ? mapEvents : [],
    spots: [],
  });
  const mapInViewCount = eventsInView.length + spotsInView.length;
  const mapTotalCount = mapEvents.length;

  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<number | null>(null);

  const handleItemSelect = useCallback((item: { type: "event" | "spot"; id: number } | null) => {
    setSelectedItemId(item?.id ?? null);
  }, []);

  const handleItemHover = useCallback((id: number | null) => {
    setHoveredItemId(id);
  }, []);

  const handleTypeChange = (type: FindType) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("view", "find");
    params.set("type", type);
    // Reset display mode when changing type
    params.delete("display");
    router.push(`/${portalSlug}?${params.toString()}`);
  };

  const availableDisplayModes: DisplayMode[] = useMemo(() => {
    if (findType === "events") return ["list", "calendar", "map"];
    if (findType === "destinations") return ["list", "map"];
    return ["list"];
  }, [findType]);
  const listDensity: ListDensity = searchParams?.get("density") === "compact" ? "compact" : "comfortable";
  const showDensityToggle = findType === "events" && displayMode === "list";

  const handleDisplayModeChange = useCallback((mode: DisplayMode) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("view", "find");
    params.set("type", findType);
    if (mode === "list") {
      params.delete("display");
    } else {
      params.set("display", mode);
    }
    router.push(`/${portalSlug}?${params.toString()}`, { scroll: false });
  }, [findType, portalSlug, router, searchParams]);

  const handleDensityChange = useCallback((density: ListDensity) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("view", "find");
    params.set("type", findType);
    if (displayMode !== "list") {
      params.set("display", displayMode);
    } else {
      params.delete("display");
    }
    if (density === "compact") {
      params.set("density", "compact");
    } else {
      params.delete("density");
    }
    router.push(`/${portalSlug}?${params.toString()}`, { scroll: false });
  }, [displayMode, findType, portalSlug, router, searchParams]);

  useEffect(() => {
    const root = viewRootRef.current;
    if (!root) return;

    const resolvePortalHeader = (): HTMLElement | null => {
      const headers = Array.from(document.querySelectorAll<HTMLElement>("header"));
      const stickyHeader = headers.find((node) => {
        const style = window.getComputedStyle(node);
        return (style.position === "sticky" || style.position === "fixed") && node.getBoundingClientRect().height > 0;
      });
      return stickyHeader ?? headers[0] ?? null;
    };

    const applyStickyOffset = () => {
      const header = resolvePortalHeader();
      const measured = header ? Math.round(header.getBoundingClientRect().height) : 52;
      const clamped = Math.max(48, Math.min(160, measured));
      root.style.setProperty("--find-list-sticky-top", `${clamped}px`);
    };

    applyStickyOffset();

    const header = resolvePortalHeader();
    const resizeObserver = header ? new ResizeObserver(() => applyStickyOffset()) : null;
    if (header && resizeObserver) {
      resizeObserver.observe(header);
    }

    window.addEventListener("resize", applyStickyOffset, { passive: true });
    window.addEventListener("orientationchange", applyStickyOffset, { passive: true });

    return () => {
      window.removeEventListener("resize", applyStickyOffset);
      window.removeEventListener("orientationchange", applyStickyOffset);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, []);

  return (
    <div ref={viewRootRef} className="py-3 space-y-3">
      <section className="relative z-40 rounded-2xl border border-[var(--twilight)]/80 bg-gradient-to-b from-[var(--night)]/94 to-[var(--void)]/86 shadow-[0_14px_30px_rgba(0,0,0,0.24)] backdrop-blur-md p-3 sm:p-4">
        {/* Type selector tabs */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex p-1 bg-[var(--void)]/72 border border-[var(--twilight)]/80 rounded-xl flex-1 sm:flex-initial sm:max-w-md min-w-0">
            {TYPE_OPTIONS.map((option) => {
              const isActive = findType === option.key;
              return (
                <button
                  key={option.key}
                  onClick={() => handleTypeChange(option.key)}
                  aria-label={option.label}
                  className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2.5 sm:py-2 rounded-lg font-mono text-xs whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-gradient-to-r from-[var(--gold)] to-[var(--coral)] text-[var(--void)] font-semibold shadow-[0_6px_16px_rgba(0,0,0,0.25)]"
                      : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/55"
                  }`}
                >
                  {option.icon}
                  {/* Mobile: show label only when active, Desktop: always show */}
                  <span className={`${isActive ? "inline" : "hidden"} sm:inline`}>
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Desktop: display toggle + add button */}
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            {availableDisplayModes.length > 1 && (
              <div className="flex rounded-full bg-[var(--void)]/70 border border-[var(--twilight)]/80 p-0.5">
                {availableDisplayModes.map((mode) => {
                  const modeConfig = DISPLAY_OPTIONS[mode];
                  const isActive = displayMode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => handleDisplayModeChange(mode)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full font-mono text-xs font-medium transition-all ${
                        isActive
                          ? "bg-[var(--cream)] text-[var(--void)] shadow-[0_6px_16px_rgba(0,0,0,0.2)]"
                          : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/45"
                      }`}
                      aria-label={`${modeConfig.label} view`}
                    >
                      {modeConfig.icon}
                      <span className="hidden md:inline">{modeConfig.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {showDensityToggle && (
              <div className="flex rounded-full bg-[var(--void)]/70 border border-[var(--twilight)]/80 p-0.5">
                <button
                  onClick={() => handleDensityChange("comfortable")}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full font-mono text-xs font-medium transition-all ${
                    listDensity === "comfortable"
                      ? "bg-[var(--cream)] text-[var(--void)] shadow-[0_6px_16px_rgba(0,0,0,0.2)]"
                      : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/45"
                  }`}
                  aria-label="Detailed density"
                >
                  Detailed
                </button>
                <button
                  onClick={() => handleDensityChange("compact")}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full font-mono text-xs font-medium transition-all ${
                    listDensity === "compact"
                      ? "bg-[var(--cream)] text-[var(--void)] shadow-[0_6px_16px_rgba(0,0,0,0.2)]"
                      : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/45"
                  }`}
                  aria-label="Simple density"
                >
                  Simple
                </button>
              </div>
            )}
            <AddNewChooser portalSlug={portalSlug} />
          </div>
        </div>

        {/* Mobile: display toggle */}
        {availableDisplayModes.length > 1 && (
          <div className="sm:hidden mt-3 flex rounded-full bg-[var(--void)]/72 border border-[var(--twilight)]/80 p-0.5">
            {availableDisplayModes.map((mode) => {
              const modeConfig = DISPLAY_OPTIONS[mode];
              const isActive = displayMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => handleDisplayModeChange(mode)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-full font-mono text-xs font-medium transition-all ${
                    isActive
                      ? "bg-[var(--cream)] text-[var(--void)] shadow-[0_6px_16px_rgba(0,0,0,0.2)]"
                      : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/45"
                  }`}
                  aria-label={`${modeConfig.label} view`}
                >
                  {modeConfig.icon}
                  <span>{modeConfig.shortLabel}</span>
                </button>
              );
            })}
          </div>
        )}
        {showDensityToggle && (
          <div className="sm:hidden mt-2 flex rounded-full bg-[var(--void)]/72 border border-[var(--twilight)]/80 p-0.5">
            <button
              onClick={() => handleDensityChange("comfortable")}
              className={`flex-1 px-2.5 py-2 rounded-full font-mono text-xs font-medium transition-all ${
                listDensity === "comfortable"
                  ? "bg-[var(--cream)] text-[var(--void)] shadow-[0_6px_16px_rgba(0,0,0,0.2)]"
                  : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/45"
              }`}
              aria-label="Detailed density"
            >
              Detailed
            </button>
            <button
              onClick={() => handleDensityChange("compact")}
              className={`flex-1 px-2.5 py-2 rounded-full font-mono text-xs font-medium transition-all ${
                listDensity === "compact"
                  ? "bg-[var(--cream)] text-[var(--void)] shadow-[0_6px_16px_rgba(0,0,0,0.2)]"
                  : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/45"
              }`}
              aria-label="Simple density"
            >
              Simple
            </button>
          </div>
        )}

        {/* Mobile: Add button on separate row */}
        <div className="sm:hidden mt-3">
          <AddNewChooser portalSlug={portalSlug} />
        </div>

        {/* Filter bar for events */}
        {findType === "events" && (
          <Suspense fallback={<div className="h-10 bg-[var(--night)] rounded-xl mt-3" />}>
            <div className="mt-2.5 pt-2.5 border-t border-[var(--twilight)]/65">
            {/* Search input */}
            <div className="relative mb-3">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search events..."
                value={eventSearch}
                onChange={(e) => updateSearchParam(e.target.value)}
                className="w-full pl-10 pr-10 h-11 bg-[var(--dusk)]/90 border border-[var(--twilight)]/80 rounded-xl font-mono text-sm text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--coral)]/55 transition-colors"
              />
              {eventSearch && (
                <button
                  onClick={() => updateSearchParam("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
                  aria-label="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <FindFilterBar variant={displayMode === "map" ? "compact" : "full"} />
            {/* Active Filters */}
            {hasActiveFilters && displayMode === "list" && (
              <div className="px-1 pt-2">
                <ActiveFiltersRow />
              </div>
            )}
            </div>
          </Suspense>
        )}

      </section>

      {/* Content based on type and display mode */}
      {findType === "events" && displayMode === "list" && (
        <EventList
          hasActiveFilters={hasActiveFilters}
          portalId={portalId}
          portalExclusive={portalExclusive}
          portalSlug={portalSlug}
          density={listDensity}
        />
      )}

      {findType === "events" && displayMode === "calendar" && (
        <Suspense fallback={<div className="py-16 text-center text-[var(--muted)]">Loading calendar...</div>}>
          {/* Mobile: Hybrid week strip + agenda view */}
          <div className="lg:hidden">
            <MobileCalendarView
              portalId={portalId}
              portalSlug={portalSlug}
              portalExclusive={portalExclusive}
            />
          </div>
          {/* Desktop: Full month grid with side panel */}
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

      {findType === "events" && displayMode === "map" && (
        <>
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
                    value={locationMode}
                    onChange={(e) => handleLocationChange(e.target.value)}
                    className="min-w-[176px] max-w-[240px] h-9 px-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-xs focus:outline-none focus:border-[var(--coral)] transition-colors appearance-none cursor-pointer select-chevron-md"
                  >
                    <option value="all">All Atlanta</option>
                    <option value="nearby">{locationLoading ? "Locating..." : userLocation ? "Nearby" : "Use my location"}</option>
                    <optgroup label="Neighborhoods">
                      {NEIGHBORHOOD_NAMES.map((hood) => (
                        <option key={hood} value={hood}>{hood}</option>
                      ))}
                    </optgroup>
                  </select>
                  {locationLoading && (
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

            {/* Desktop: split-pane (drawer left + map right) */}
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
                <MapViewWrapper
                  events={mapEvents}
                  portalId={portalId}
                  portalExclusive={portalExclusive}
                  isFetching={mapEventsFetching}
                  userLocation={isNearbyMode ? userLocation : undefined}
                  viewRadius={isNearbyMode ? 1 : undefined}
                  centerPoint={mapCenterPoint}
                  fitAllMarkers={shouldFitAll}
                  onBoundsChange={handleBoundsChange}
                  selectedItemId={selectedItemId}
                  hoveredItemId={hoveredItemId}
                  onItemSelect={handleItemSelect}
                />
              </div>
            </div>

            {/* Mobile: full-height map with bottom sheet overlay */}
            <div
              className="md:hidden relative"
              style={{ height: MAP_MOBILE_HEIGHT }}
            >
              <MapViewWrapper
                events={mapEvents}
                portalId={portalId}
                portalExclusive={portalExclusive}
                isFetching={mapEventsFetching}
                showMobileSheet={false}
                userLocation={isNearbyMode ? userLocation : undefined}
                viewRadius={isNearbyMode ? 1 : undefined}
                centerPoint={mapCenterPoint}
                fitAllMarkers={shouldFitAll}
                onBoundsChange={handleBoundsChange}
                selectedItemId={selectedItemId}
                hoveredItemId={hoveredItemId}
                onItemSelect={handleItemSelect}
              />
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
        </>
      )}

      {findType === "classes" && (
        <Suspense fallback={<div className="py-16 text-center text-[var(--muted)]">Loading classes...</div>}>
          <ClassesView
            portalId={portalId}
            portalSlug={portalSlug}
          />
        </Suspense>
      )}

      {findType === "destinations" && displayMode === "list" && (
        <Suspense fallback={<div className="py-16 text-center text-[var(--muted)]">Loading destinations...</div>}>
          <PortalSpotsView
            portalId={portalId}
            portalSlug={portalSlug}
            isExclusive={portalExclusive}
          />
        </Suspense>
      )}

      {findType === "destinations" && displayMode === "map" && (
        <>
          <div className="relative z-0 -mx-4 mb-3 border border-[var(--twilight)]/85 bg-[var(--void)]/65 shadow-[0_18px_40px_rgba(0,0,0,0.28)] xl:mx-0 overflow-hidden">
            <div className="px-3 py-2.5 border-b border-[var(--twilight)]/75 bg-gradient-to-b from-[var(--night)]/95 to-[var(--void)]/84 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[var(--muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <select
                  value={locationMode}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  className="flex-1 max-w-[240px] h-9 px-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-xs focus:outline-none focus:border-[var(--coral)] transition-colors appearance-none cursor-pointer select-chevron-md"
                >
                  <option value="all">All Atlanta</option>
                  <option value="nearby">{locationLoading ? "Locating..." : userLocation ? "Nearby" : "Use my location"}</option>
                  <optgroup label="Neighborhoods">
                    {NEIGHBORHOOD_NAMES.map((hood) => (
                      <option key={hood} value={hood}>{hood}</option>
                    ))}
                  </optgroup>
                </select>
                {locationLoading && (
                  <div className="w-4 h-4 rounded-full border-2 border-[var(--coral)] border-t-transparent animate-spin flex-shrink-0" />
                )}
              </div>
            </div>
            <div style={{ height: DESTINATIONS_MAP_HEIGHT }}>
              <MapViewWrapper
                portalId={portalId}
                portalExclusive={portalExclusive}
                userLocation={isNearbyMode ? userLocation : undefined}
                viewRadius={isNearbyMode ? 1 : undefined}
                centerPoint={mapCenterPoint}
                fitAllMarkers={shouldFitAll}
                onBoundsChange={handleBoundsChange}
                selectedItemId={selectedItemId}
                hoveredItemId={hoveredItemId}
                onItemSelect={handleItemSelect}
              />
            </div>
          </div>
        </>
      )}

    </div>
  );
}

export default function FindView(props: FindViewProps) {
  return (
    <Suspense
      fallback={
        <div className="py-3 space-y-3">
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 w-20 skeleton-shimmer rounded-full" />
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 skeleton-shimmer rounded-xl" />
            ))}
          </div>
        </div>
      }
    >
      <FindViewInner {...props} />
    </Suspense>
  );
}
