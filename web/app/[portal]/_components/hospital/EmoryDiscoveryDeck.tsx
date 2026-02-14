"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map as MapboxMap, Marker, NavigationControl } from "react-map-gl";
import type { MapRef } from "react-map-gl";
import type {
  EmoryFederationEventPreview,
  EmoryFederationOrgPreview,
  EmoryFederationVenuePreview,
} from "@/lib/emory-federation-showcase";
import { ATLANTA_CENTER, MAPBOX_TOKEN, getMapStyle } from "@/lib/map-config";
import {
  buildDiscoveryItems,
  groupEventItemsByDay,
  rankDiscoveryItems,
  type DiscoveryItem,
  type DiscoveryFilter,
  type DiscoverySort,
  type DiscoveryTab,
  type DiscoveryView,
} from "@/lib/emory-discovery";

type EmoryDiscoveryDeckProps = {
  stateKey?: string;
  events: EmoryFederationEventPreview[];
  venues: EmoryFederationVenuePreview[];
  organizations: EmoryFederationOrgPreview[];
  title: string;
  subtitle: string;
  defaultTab?: DiscoveryTab;
  emptyHref: string;
  quickFilters?: DiscoveryFilter[];
  contextParams?: Record<string, string | undefined>;
};

const DEFAULT_FILTERS: DiscoveryFilter[] = [
  { id: "all", label: "All", keywords: [] },
  { id: "family", label: "Family", keywords: ["family", "caregiver", "kids", "child"] },
  { id: "fitness", label: "Fitness", keywords: ["fitness", "walk", "movement", "yoga", "wellness"] },
  { id: "food", label: "Food access", keywords: ["food", "meal", "market", "nutrition", "kitchen", "cafe"] },
  { id: "care", label: "Care support", keywords: ["clinic", "screening", "pharmacy", "support", "health"] },
];

const TAB_LABELS: Record<DiscoveryTab, string> = {
  events: "Events",
  venues: "Venues",
  organizations: "Orgs",
};

const VIEW_LABELS: Record<DiscoveryView, string> = {
  list: "List",
  map: "Map",
  timeline: "Timeline",
};

const FALLBACK_CARD_IMAGES: Record<DiscoveryItem["kind"], string> = {
  event: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=640&q=80",
  venue: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=640&q=80",
  organization: "https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=640&q=80",
};

function appendContextParams(
  href: string,
  contextParams: Record<string, string | undefined> | undefined,
): string {
  if (!contextParams) return href;
  if (/^https?:\/\//i.test(href)) return href;

  const contextEntries = Object.entries(contextParams).filter(([, value]) => Boolean(value));
  if (contextEntries.length === 0) return href;

  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  for (const [key, value] of contextEntries) {
    if (!value) continue;
    if (!params.has(key)) params.set(key, value);
  }
  const nextQuery = params.toString();
  return nextQuery ? `${path}?${nextQuery}` : path;
}

function allowedSortsForTab(tab: DiscoveryTab): DiscoverySort[] {
  if (tab === "events") return ["relevant", "soonest", "alpha"];
  if (tab === "venues") return ["relevant", "closest", "active", "alpha"];
  return ["relevant", "active", "alpha"];
}

function parseSort(input: string | null, tab: DiscoveryTab): DiscoverySort {
  const valid = allowedSortsForTab(tab);
  if (input && valid.includes(input as DiscoverySort)) return input as DiscoverySort;
  return "relevant";
}

function readSavedPlan(storageKey: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

type VenueMarkerPoint = {
  key: string;
  title: string;
  subtitle: string;
  detailHref: string;
  mapsHref: string | null;
  lng: number;
  lat: number;
};

type VenueMarker =
  | { kind: "point"; key: string; point: VenueMarkerPoint }
  | { kind: "cluster"; key: string; lng: number; lat: number; count: number };

type VenueMapExplorerProps = {
  items: ReturnType<typeof buildDiscoveryItems>["venues"];
  savedIds: string[];
  contextParams?: Record<string, string | undefined>;
  onToggleSaved: (id: string) => void;
};

function VenueMapExplorer({
  items,
  savedIds,
  contextParams,
  onToggleSaved,
}: VenueMapExplorerProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [mounted, setMounted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [viewTick, setViewTick] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    // @ts-expect-error - dynamic CSS import for map runtime only.
    import("mapbox-gl/dist/mapbox-gl.css");
  }, []);

  const points = useMemo<VenueMarkerPoint[]>(
    () =>
      items.flatMap((item) => {
        if (item.lat === null || item.lng === null) return [];
        return [{
          key: item.key,
          title: item.title,
          subtitle: item.subtitle,
          detailHref: item.detailHref,
          mapsHref: item.mapsHref,
          lat: item.lat,
          lng: item.lng,
        }];
      }),
    [items],
  );

  const mapCenter = useMemo(() => {
    if (points.length === 0) {
      return { lat: ATLANTA_CENTER.latitude, lng: ATLANTA_CENTER.longitude };
    }
    const aggregate = points.reduce(
      (acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }),
      { lat: 0, lng: 0 },
    );
    return {
      lat: aggregate.lat / points.length,
      lng: aggregate.lng / points.length,
    };
  }, [points]);

  const selectedPoint = useMemo(
    () => points.find((point) => point.key === selectedKey) || null,
    [points, selectedKey],
  );

  const renderMarkers = useMemo<VenueMarker[]>(() => {
    void viewTick;
    if (!mapReady || !mapRef.current) {
      return points.map((point) => ({
        kind: "point",
        key: `point-${point.key}`,
        point,
      }));
    }

    const map = mapRef.current;
    const bounds = map.getBounds();
    if (!bounds) {
      return points.map((point) => ({
        kind: "point",
        key: `point-${point.key}`,
        point,
      }));
    }

    const visiblePoints = points.filter((point) => bounds.contains([point.lng, point.lat]));
    const bucketSize = 58;
    const buckets = new globalThis.Map<string, VenueMarkerPoint[]>();

    visiblePoints.forEach((point) => {
      const projected = map.project([point.lng, point.lat]);
      const bucketKey = `${Math.floor(projected.x / bucketSize)}:${Math.floor(projected.y / bucketSize)}`;
      const bucket = buckets.get(bucketKey);
      if (bucket) bucket.push(point);
      else buckets.set(bucketKey, [point]);
    });

    const markers: VenueMarker[] = [];
    buckets.forEach((bucket, key) => {
      if (bucket.length === 1) {
        markers.push({ kind: "point", key: `point-${bucket[0].key}`, point: bucket[0] });
        return;
      }

      const selectedIndex = selectedKey ? bucket.findIndex((point) => point.key === selectedKey) : -1;
      const clusterPoints = selectedIndex >= 0 ? bucket.filter((_, idx) => idx !== selectedIndex) : bucket;

      if (selectedIndex >= 0) {
        const selected = bucket[selectedIndex];
        markers.push({ kind: "point", key: `point-${selected.key}`, point: selected });
      }

      if (clusterPoints.length === 0) return;
      if (clusterPoints.length === 1) {
        markers.push({ kind: "point", key: `point-${clusterPoints[0].key}`, point: clusterPoints[0] });
        return;
      }

      const center = clusterPoints.reduce(
        (acc, point) => ({ lng: acc.lng + point.lng, lat: acc.lat + point.lat }),
        { lng: 0, lat: 0 },
      );
      const lng = center.lng / clusterPoints.length;
      const lat = center.lat / clusterPoints.length;
      markers.push({
        kind: "cluster",
        key: `cluster-${key}-${clusterPoints.length}-${Math.round(lng * 1000)}-${Math.round(lat * 1000)}`,
        lng,
        lat,
        count: clusterPoints.length,
      });
    });

    return markers;
  }, [mapReady, points, selectedKey, viewTick]);

  const handleSelectVenue = useCallback((point: VenueMarkerPoint) => {
    setSelectedKey(point.key);
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: [point.lng, point.lat],
      zoom: Math.max(mapRef.current.getZoom(), 14),
      duration: 480,
    });
  }, []);

  const limitedItems = items.slice(0, 8);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)] gap-2.5">
      <div className="relative overflow-hidden rounded-md border border-[var(--twilight)] bg-[var(--surface-1)] min-h-[320px]">
        {!mounted ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-[var(--muted)]">Loading map…</p>
          </div>
        ) : points.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <p className="text-sm text-[var(--muted)]">No geocoded venues in this filter yet. Try another filter or switch to list view.</p>
          </div>
        ) : (
          <MapboxMap
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={{
              latitude: mapCenter.lat,
              longitude: mapCenter.lng,
              zoom: points.length > 1 ? 12.2 : 14.2,
            }}
            mapStyle={getMapStyle(true)}
            onLoad={() => setMapReady(true)}
            onMoveEnd={() => setViewTick((value) => value + 1)}
            onClick={() => setSelectedKey(null)}
            style={{ width: "100%", height: "100%" }}
            attributionControl
            maxZoom={18}
            minZoom={9}
            reuseMaps
          >
            <NavigationControl position="top-right" showCompass={false} />
            {renderMarkers.map((marker) => {
              if (marker.kind === "cluster") {
                return (
                  <Marker
                    key={marker.key}
                    longitude={marker.lng}
                    latitude={marker.lat}
                    anchor="center"
                    onClick={(event) => {
                      event.originalEvent.stopPropagation();
                      const map = mapRef.current;
                      if (!map) return;
                      map.flyTo({
                        center: [marker.lng, marker.lat],
                        zoom: Math.min(map.getZoom() + 1.2, 16),
                        duration: 420,
                      });
                    }}
                  >
                    <button
                      type="button"
                      className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-[#1d4ed8] bg-[#2563eb] px-2 text-xs font-semibold text-white shadow-sm"
                      aria-label={`Cluster of ${marker.count} venues`}
                    >
                      {marker.count}
                    </button>
                  </Marker>
                );
              }

              const isSelected = selectedKey === marker.point.key;
              return (
                <Marker
                  key={marker.key}
                  longitude={marker.point.lng}
                  latitude={marker.point.lat}
                  anchor="center"
                  onClick={(event) => {
                    event.originalEvent.stopPropagation();
                    handleSelectVenue(marker.point);
                  }}
                >
                  <button
                    type="button"
                    className={`h-4 w-4 rounded-full border-2 shadow-sm ${isSelected ? "border-[#0f172a] bg-[#16a34a]" : "border-[#1d4ed8] bg-white"}`}
                    aria-label={`Open ${marker.point.title}`}
                  />
                </Marker>
              );
            })}
          </MapboxMap>
        )}

        {selectedPoint && (
          <div className="pointer-events-none absolute bottom-2 left-2 right-2 rounded-md border border-[#dbe6f8] bg-white/96 px-3 py-2 shadow-sm">
            <p className="text-sm font-semibold text-[var(--cream)]">{selectedPoint.title}</p>
            <p className="text-xs text-[var(--muted)]">{selectedPoint.subtitle}</p>
            <div className="mt-1 flex flex-wrap gap-3 pointer-events-auto">
              <Link href={appendContextParams(selectedPoint.detailHref, contextParams)} className="emory-link-btn">Open</Link>
              {selectedPoint.mapsHref && (
                <a href={selectedPoint.mapsHref} target="_blank" rel="noreferrer" className="emory-link-btn">Map</a>
              )}
              <button type="button" onClick={() => onToggleSaved(selectedPoint.key)} className="emory-link-btn">
                {savedIds.includes(selectedPoint.key) ? "Saved" : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {limitedItems.map((item) => {
          const hasCoordinates = item.lat !== null && item.lng !== null;
          const isSelected = selectedKey === item.key;
          const thumb = item.imageUrl || FALLBACK_CARD_IMAGES[item.kind];
          return (
            <article
              key={item.key}
              className={`rounded-md border px-3 py-2.5 ${isSelected ? "border-[#b9d5ff] bg-[#f4f8ff]" : "border-[var(--twilight)] bg-white"}`}
            >
              <div className="flex items-start gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!hasCoordinates) return;
                    handleSelectVenue({
                      key: item.key,
                      title: item.title,
                      subtitle: item.subtitle,
                      detailHref: item.detailHref,
                      mapsHref: item.mapsHref,
                      lat: item.lat as number,
                      lng: item.lng as number,
                    });
                  }}
                  className={`h-14 w-16 overflow-hidden rounded border border-[var(--twilight)] shrink-0 ${hasCoordinates ? "cursor-pointer" : "cursor-default"}`}
                  aria-label={`Preview ${item.title}`}
                >
                  <img src={thumb} alt={item.title} className="h-full w-full object-cover" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!hasCoordinates) return;
                    handleSelectVenue({
                      key: item.key,
                      title: item.title,
                      subtitle: item.subtitle,
                      detailHref: item.detailHref,
                      mapsHref: item.mapsHref,
                      lat: item.lat as number,
                      lng: item.lng as number,
                    });
                  }}
                  className={`text-left ${hasCoordinates ? "cursor-pointer" : "cursor-default"}`}
                >
                  <p className="text-sm font-semibold text-[var(--cream)]">{item.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">{item.subtitle}</p>
                </button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-3">
                <Link href={appendContextParams(item.detailHref, contextParams)} className="emory-link-btn">Open</Link>
                {item.mapsHref && (
                  <a href={item.mapsHref} target="_blank" rel="noreferrer" className="emory-link-btn">Map</a>
                )}
                <button type="button" onClick={() => onToggleSaved(item.key)} className="emory-link-btn">
                  {savedIds.includes(item.key) ? "Saved" : "Save"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default function EmoryDiscoveryDeck({
  stateKey,
  events,
  venues,
  organizations,
  title,
  subtitle,
  defaultTab = "events",
  emptyHref,
  quickFilters = DEFAULT_FILTERS,
  contextParams,
}: EmoryDiscoveryDeckProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const keyPrefix = stateKey || "discovery";

  const tabParam = searchParams.get(`${keyPrefix}_tab`) as DiscoveryTab | null;
  const viewParam = searchParams.get(`${keyPrefix}_view`) as DiscoveryView | null;
  const queryParam = searchParams.get(`${keyPrefix}_q`) || "";
  const filterParam = searchParams.get(`${keyPrefix}_filter`) || quickFilters[0]?.id || "all";

  const initialTab = tabParam && Object.keys(TAB_LABELS).includes(tabParam) ? tabParam : defaultTab;
  const initialView = viewParam && Object.keys(VIEW_LABELS).includes(viewParam) ? viewParam : "list";
  const storageKey = `emory-discovery-plan:${keyPrefix}`;

  const [activeTab, setActiveTab] = useState<DiscoveryTab>(initialTab);
  const [activeView, setActiveView] = useState<DiscoveryView>(initialView);
  const [query, setQuery] = useState(queryParam);
  const [activeFilter, setActiveFilter] = useState(filterParam);
  const [sort, setSort] = useState<DiscoverySort>(parseSort(searchParams.get(`${keyPrefix}_sort`), initialTab));
  const [savedIds, setSavedIds] = useState<string[]>(() => readSavedPlan(storageKey));
  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const activeSort = allowedSortsForTab(activeTab).includes(sort) ? sort : "relevant";

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(savedIds));
    } catch {
      // Ignore storage write errors in constrained environments.
    }
  }, [savedIds, storageKey]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(`${keyPrefix}_tab`, activeTab);
    params.set(`${keyPrefix}_view`, activeView);
    if (query.trim()) params.set(`${keyPrefix}_q`, query.trim());
    else params.delete(`${keyPrefix}_q`);
    if (activeFilter) params.set(`${keyPrefix}_filter`, activeFilter);
    if (activeSort !== "relevant") params.set(`${keyPrefix}_sort`, activeSort);
    else params.delete(`${keyPrefix}_sort`);
    const nextQuery = params.toString();
    if (nextQuery !== searchParams.toString()) {
      router.replace(`${pathname}?${nextQuery}`, { scroll: false });
    }
  }, [activeTab, activeView, query, activeFilter, activeSort, pathname, router, searchParams, keyPrefix]);

  const visibleFilters = useMemo(
    () => quickFilters.filter((filter) => !filter.tabs || filter.tabs.includes(activeTab)),
    [quickFilters, activeTab],
  );

  const activeFilterDef = useMemo(
    () => quickFilters.find((filter) => filter.id === activeFilter) || quickFilters[0] || DEFAULT_FILTERS[0],
    [quickFilters, activeFilter],
  );

  const model = useMemo(
    () => buildDiscoveryItems({ events, venues, organizations }),
    [events, venues, organizations],
  );

  const rankedEvents = useMemo(
    () => rankDiscoveryItems({ items: model.events, now: new Date(), query, filter: activeFilterDef, sort: activeTab === "events" ? activeSort : "relevant" }),
    [model.events, query, activeFilterDef, activeSort, activeTab],
  );
  const rankedVenues = useMemo(
    () => rankDiscoveryItems({ items: model.venues, now: new Date(), query, filter: activeFilterDef, sort: activeTab === "venues" ? activeSort : "relevant" }),
    [model.venues, query, activeFilterDef, activeSort, activeTab],
  );
  const rankedOrgs = useMemo(
    () => rankDiscoveryItems({ items: model.organizations, now: new Date(), query, filter: activeFilterDef, sort: activeTab === "organizations" ? activeSort : "relevant" }),
    [model.organizations, query, activeFilterDef, activeSort, activeTab],
  );

  const activeItems = activeTab === "events" ? rankedEvents : activeTab === "venues" ? rankedVenues : rankedOrgs;
  const activeCount = activeItems.length;

  const allByKey = useMemo(() => {
    const map = new Map<string, { title: string; href: string; subtitle: string }>();
    [...model.events, ...model.venues, ...model.organizations].forEach((item) => {
      map.set(item.key, { title: item.title, href: item.detailHref, subtitle: item.subtitle });
    });
    return map;
  }, [model]);

  const savedItems = savedIds
    .map((id) => allByKey.get(id) ? { id, ...allByKey.get(id)! } : null)
    .filter((item): item is { id: string; title: string; href: string; subtitle: string } => Boolean(item));

  const timelineGroups = useMemo(() => groupEventItemsByDay(rankedEvents), [rankedEvents]);

  const toggleSaved = (id: string) => {
    setSavedIds((current) => (
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    ));
  };

  const handleTabChange = (tab: DiscoveryTab) => {
    setActiveTab(tab);
    if (!allowedSortsForTab(tab).includes(activeSort)) {
      setSort("relevant");
    }
    if (activeView === "timeline" && tab !== "events") {
      setActiveView("list");
    }
    if (activeView === "map" && tab !== "venues") {
      setActiveView("list");
    }
  };

  const handleViewChange = (view: DiscoveryView) => {
    if (view === "timeline" && activeTab !== "events") {
      setActiveTab("events");
    }
    if (view === "map" && activeTab !== "venues") {
      setActiveTab("venues");
    }
    setActiveView(view);
  };

  const resetControls = () => {
    setQuery("");
    setActiveFilter(quickFilters[0]?.id || "all");
    setSort("relevant");
    setActiveView("list");
  };

  return (
    <section className="rounded-xl border border-[var(--twilight)] bg-white p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-[1.2rem] sm:text-[1.35rem] leading-[1.02] text-[var(--cream)]">{title}</h3>
          <p className="mt-1 text-xs sm:text-sm text-[var(--muted)]">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsPlanOpen((value) => !value)}
            className="emory-secondary-btn inline-flex items-center px-2.5 py-1.5 text-xs"
          >
            My plan ({savedItems.length})
          </button>
          <span className="emory-chip">{activeCount} results</span>
        </div>
      </div>

      {isPlanOpen && (
        <div className="mt-2 rounded-md border border-[var(--twilight)] bg-[var(--surface-1)] p-2.5">
          {savedItems.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">Save items as you browse and they appear here.</p>
          ) : (
            <div className="space-y-1.5">
              {savedItems.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-2 rounded border border-[var(--twilight)] bg-white px-2.5 py-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--cream)]">{item.title}</p>
                    <p className="text-xs text-[var(--muted)]">{item.subtitle}</p>
                    <Link href={appendContextParams(item.href, contextParams)} className="emory-link-btn mt-0.5 inline-flex">Open</Link>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSaved(item.id)}
                    className="emory-link-btn"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {(Object.keys(TAB_LABELS) as DiscoveryTab[]).map((tab) => {
          const active = tab === activeTab;
          const tabCount = tab === "events" ? rankedEvents.length : tab === "venues" ? rankedVenues.length : rankedOrgs.length;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              className={`emory-chip !normal-case !tracking-normal !text-[11px] ${active ? "!bg-[#eef4ff] !border-[#c2d4f1] !text-[#143b83]" : ""}`}
              aria-pressed={active}
            >
              {TAB_LABELS[tab]} ({tabCount})
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {(Object.keys(VIEW_LABELS) as DiscoveryView[]).map((view) => {
          const disabled = (view === "timeline" && activeTab !== "events")
            || (view === "map" && activeTab !== "venues");
          const active = view === activeView;
          return (
            <button
              key={view}
              type="button"
              onClick={() => !disabled && handleViewChange(view)}
              disabled={disabled}
              className={`emory-chip !normal-case !tracking-normal !text-[11px] ${active ? "!bg-[#f2f8eb] !border-[#bde2b7] !text-[#205634]" : ""} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {VIEW_LABELS[view]}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {visibleFilters.map((filter) => {
          const active = filter.id === activeFilter;
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              className={`emory-chip !normal-case !tracking-normal !text-[11px] ${active ? "!bg-[#f3f7ff] !border-[#c2d4f1] !text-[#143b83]" : ""}`}
              aria-pressed={active}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
        <label>
          <span className="sr-only">Search discovery results</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search events, venues, or organizations"
            className="w-full rounded-md border border-[var(--twilight)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--cream)] placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#bfd4f5]"
          />
        </label>
        <label>
          <span className="sr-only">Sort results</span>
          <select
            value={activeSort}
            onChange={(event) => setSort(event.target.value as DiscoverySort)}
            className="w-full rounded-md border border-[var(--twilight)] bg-white px-2.5 py-2 text-sm text-[var(--cream)]"
          >
            {allowedSortsForTab(activeTab).map((option) => (
              <option key={option} value={option}>
                {option === "relevant" ? "Most relevant" : option === "soonest" ? "Soonest" : option === "closest" ? "Closest" : option === "active" ? "Most active" : "A-Z"}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={resetControls}
          className="emory-secondary-btn inline-flex items-center justify-center px-3 py-2 text-xs"
        >
          Reset
        </button>
      </div>

      {activeView === "timeline" && activeTab === "events" && (
        <div className="mt-3 space-y-2">
          {timelineGroups.slice(0, 5).map((group) => (
            <section key={group.day} className="rounded-md border border-[var(--twilight)] bg-[var(--surface-1)] p-2.5">
              <p className="text-xs font-semibold uppercase tracking-[0.05em] text-[#4b5563]">{group.day}</p>
              <div className="mt-1.5 space-y-1.5">
                {group.items.slice(0, 4).map((item) => (
                  <article key={item.key} className="rounded border border-[var(--twilight)] bg-white px-2.5 py-2">
                    <div className="flex items-start gap-2.5">
                      <div className="h-12 w-14 overflow-hidden rounded border border-[var(--twilight)] shrink-0">
                        <img src={item.imageUrl || FALLBACK_CARD_IMAGES[item.kind]} alt={item.title} className="h-full w-full object-cover" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--cream)]">{item.title}</p>
                        <p className="text-xs text-[var(--muted)]">{item.subtitle}</p>
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3">
                      <Link href={appendContextParams(item.detailHref, contextParams)} className="emory-link-btn">View Details</Link>
                      <button type="button" onClick={() => toggleSaved(item.key)} className="emory-link-btn">
                        {savedIds.includes(item.key) ? "Saved" : "Save"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {activeView === "map" && activeTab === "venues" && (
        <div className="mt-3">
          <VenueMapExplorer
            items={rankedVenues}
            savedIds={savedIds}
            contextParams={contextParams}
            onToggleSaved={toggleSaved}
          />
        </div>
      )}

      {activeView !== "timeline" && !(activeView === "map" && activeTab === "venues") && (
        <div className="mt-3 space-y-2">
          {activeItems.slice(0, activeView === "map" ? 9 : 8).map((item) => {
            const thumb = item.imageUrl || FALLBACK_CARD_IMAGES[item.kind];
            return (
              <article key={item.key} className="rounded-md border border-[var(--twilight)] bg-white px-3 py-2.5">
                <div className="flex items-start gap-3">
                  <div className="h-16 w-20 overflow-hidden rounded border border-[var(--twilight)] shrink-0">
                    <img src={thumb} alt={item.title} className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--cream)]">{item.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{item.subtitle}</p>
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-3">
                  <Link href={appendContextParams(item.detailHref, contextParams)} className="emory-link-btn">Open</Link>
                  {item.mapsHref && (
                    <a href={item.mapsHref} target="_blank" rel="noreferrer" className="emory-link-btn">Map</a>
                  )}
                  <button type="button" onClick={() => toggleSaved(item.key)} className="emory-link-btn">
                    {savedIds.includes(item.key) ? "Saved" : "Save"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {activeCount > (activeView === "map" ? 9 : 8) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-[var(--muted)]">Showing the first {activeView === "map" ? 9 : 8} matches.</p>
          <Link href={appendContextParams(emptyHref, contextParams)} className="emory-link-btn inline-flex">
            Open Full Listings
          </Link>
        </div>
      )}

      {activeCount === 0 && (
        <div className="mt-3 rounded-md border border-dashed border-[var(--twilight)] bg-[var(--surface-1)] p-3">
          <p className="text-sm text-[var(--muted)]">No matches yet. Try a different filter or reset controls.</p>
          <Link href={appendContextParams(emptyHref, contextParams)} className="emory-link-btn mt-1 inline-flex">Open Full Listings</Link>
        </div>
      )}
    </section>
  );
}
