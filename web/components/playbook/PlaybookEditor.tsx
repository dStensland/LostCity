"use client";

/**
 * PlaybookEditor — Production editor connected to real data via useItinerary.
 *
 * Renders a timeline with Mapbox map, walk-time connectors, danger zone
 * calculations, drag-to-reorder, and an AddStopPanel for adding stops.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Map, { Marker, Source, Layer, NavigationControl, type MapRef } from "react-map-gl";
import { MAPBOX_TOKEN, DARK_STYLE } from "@/lib/map-config";
import MapPin from "@/components/map/MapPin";
import AddStopPanel from "@/components/playbook/AddStopPanel";
import { useItinerary } from "@/lib/hooks/useItinerary";
import { useAuth } from "@/lib/auth-context";
import {
  getItemTitle,
  getItemCoords,
  formatItineraryTime,
  formatWalkTime,
  formatWalkDistance,
  type ItineraryItem,
  type LocalItineraryItem,
  type AddItineraryItemInput,
} from "@/lib/itinerary-utils";
import { getCategoryColor } from "@/components/CategoryIcon";
import { useToast } from "@/components/Toast";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { arrayMove } from "@dnd-kit/sortable";
import {
  Star,
  ArrowLeft,
  ShareNetwork,
  Trash,
  MapTrifold,
  Plus,
  CaretDown,
  PencilSimple,
  Check,
  DotsSixVertical,
  Notebook,
} from "@phosphor-icons/react/dist/ssr";

import {
  ZONE_COLORS,
  ROUTE_GLOW_LAYER,
  ROUTE_LINE_LAYER,
  getDangerLevel,
  getBufferLabel,
  getItemCategory,
  WalkingPersonIcon,
} from "@/lib/playbook-shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlaybookEditorProps {
  itineraryId: string;
  portalId: string;
  portalSlug: string;
  portalName?: string;
}

// ---------------------------------------------------------------------------
// PlaybookMap sub-component
// ---------------------------------------------------------------------------

function PlaybookMap({
  items,
  className = "",
}: {
  items: (ItineraryItem | LocalItineraryItem)[];
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    // @ts-expect-error - Dynamic CSS import for Mapbox GL
    import("mapbox-gl/dist/mapbox-gl.css").then(() => setMounted(true));
  }, []);

  const coords = useMemo(
    () =>
      items
        .map((item) => getItemCoords(item))
        .filter((c): c is { lat: number; lng: number } => c !== null),
    [items],
  );

  const center = useMemo(() => {
    if (coords.length === 0) return { lat: 33.7725, lng: -84.3655 };
    const avgLat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
    const avgLng = coords.reduce((s, c) => s + c.lng, 0) / coords.length;
    return { lat: avgLat, lng: avgLng };
  }, [coords]);

  // Re-center map when items change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || coords.length === 0) return;
    if (coords.length === 1) {
      map.flyTo({ center: [coords[0].lng, coords[0].lat], zoom: 14, duration: 800 });
    } else {
      const lngs = coords.map((c) => c.lng);
      const lats = coords.map((c) => c.lat);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 60, duration: 800 },
      );
    }
  }, [coords]);

  const routeGeoJson = useMemo(
    () => ({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: coords.map((c) => [c.lng, c.lat]),
      },
    }),
    [coords],
  );

  if (!mounted) {
    return (
      <div className={`${className} relative overflow-hidden`} style={{ background: "var(--void)" }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} relative overflow-hidden`}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={DARK_STYLE}
        initialViewState={{ longitude: center.lng, latitude: center.lat, zoom: 13 }}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {coords.length >= 2 && (
          <Source id="route" type="geojson" data={routeGeoJson}>
            <Layer {...ROUTE_GLOW_LAYER} />
            <Layer {...ROUTE_LINE_LAYER} />
          </Source>
        )}

        {items.map((item, idx) => {
          const c = getItemCoords(item);
          if (!c) return null;
          const isAnchor = idx === 0;
          const category = getItemCategory(item);

          return isAnchor ? (
            <Marker key={item.id} longitude={c.lng} latitude={c.lat} anchor="center">
              <div
                className="flex items-center justify-center rounded-full cursor-pointer"
                style={{
                  width: 34,
                  height: 34,
                  background: "rgba(255, 217, 61, 0.12)",
                  border: "2.5px solid rgba(255, 217, 61, 0.6)",
                  color: "var(--gold)",
                  boxShadow: "0 0 24px rgba(255, 217, 61, 0.3)",
                }}
              >
                <Star size={14} weight="fill" />
              </div>
            </Marker>
          ) : (
            <Marker key={item.id} longitude={c.lng} latitude={c.lat} anchor="bottom">
              <MapPin category={category} />
            </Marker>
          );
        })}
      </Map>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableStop — wraps each timeline stop for dnd-kit
// ---------------------------------------------------------------------------

function SortableStop({
  item,
  idx,
  items,
  saving,
  onRemove,
}: {
  item: ItineraryItem | LocalItineraryItem;
  idx: number;
  items: (ItineraryItem | LocalItineraryItem)[];
  saving: boolean;
  onRemove: (id: string) => void;
}) {
  const isAnchor = idx === 0;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: isAnchor,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : undefined,
  };

  const title = getItemTitle(item);
  const time = "start_time" in item ? formatItineraryTime(item.start_time) : "";
  const walkTime = formatWalkTime(item.walk_time_minutes);
  const walkDist = formatWalkDistance(item.walk_distance_meters);
  const category = getItemCategory(item);
  const accentColor = isAnchor ? "var(--gold)" : getCategoryColor(category);

  const walkMin = item.walk_time_minutes || 0;
  const duration = item.duration_minutes || 60;
  const bufferMinutes = duration - walkMin;
  const dangerLevel = walkMin > 0 ? getDangerLevel(walkMin, bufferMinutes) : "safe";

  return (
    <div ref={setNodeRef} style={style}>
      {/* Walk time connector */}
      {idx > 0 && (items[idx].walk_time_minutes != null || items[idx].walk_distance_meters != null) && (
        <div className="relative flex gap-3 py-1">
          <div className="shrink-0 w-[54px]" />
          <div className="shrink-0 w-6 flex justify-center">
            <div className="w-px h-full" style={{ background: "rgba(0, 212, 232, 0.1)" }} />
          </div>
          <div className="flex-1 flex flex-col gap-1 py-0.5">
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style={{ color: "var(--muted)", opacity: 0.35 }}>
                <path d="M7.875 1.75C8.358 1.75 8.75 1.358 8.75 0.875C8.75 0.392 8.358 0 7.875 0C7.392 0 7 0.392 7 0.875C7 1.358 7.392 1.75 7.875 1.75Z" fill="currentColor" />
                <path d="M9.625 4.375L7.875 2.625L5.25 5.25M7 7L5.25 10.5L6.5625 10.5M7 7L8.75 10.5L7.4375 10.5M7 7L7.875 5.25" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[10px]" style={{ fontFamily: "var(--font-mono)", color: "var(--muted)", opacity: 0.45 }}>
                {walkTime}{walkDist ? ` · ${walkDist}` : ""}
              </span>
            </div>
            {walkMin > 0 && (
              <div
                className="inline-flex items-center gap-1.5 self-start px-2 py-0.5 rounded-md text-[10px]"
                style={{
                  fontFamily: "var(--font-mono)",
                  background: ZONE_COLORS[dangerLevel].bg,
                  border: `1px solid ${ZONE_COLORS[dangerLevel].border}`,
                  color: ZONE_COLORS[dangerLevel].text,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: ZONE_COLORS[dangerLevel].dot }}
                />
                {getBufferLabel(dangerLevel, Math.max(0, bufferMinutes))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stop block */}
      <div className="relative flex gap-3">
        {/* Time column */}
        <div className="shrink-0 w-[54px] flex flex-col items-end pt-3">
          <span
            className="text-[11px] leading-none"
            style={{
              fontFamily: "var(--font-mono)",
              color: isAnchor ? "var(--gold)" : "var(--muted)",
              opacity: isAnchor ? 1 : 0.7,
            }}
          >
            {time}
          </span>
        </div>

        {/* Spine dot */}
        <div className="shrink-0 relative z-10 flex items-start pt-3">
          {isAnchor ? (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[12px]"
              style={{
                background: "rgba(255, 217, 61, 0.15)",
                border: "2px solid rgba(255, 217, 61, 0.55)",
                color: "var(--gold)",
                boxShadow: "0 0 16px rgba(255, 217, 61, 0.3)",
              }}
            >
              <Star size={12} weight="fill" />
            </div>
          ) : (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold"
              style={{
                fontFamily: "var(--font-mono)",
                background: "var(--night)",
                border: `2px solid ${accentColor}40`,
                color: accentColor,
              }}
            >
              {idx + 1}
            </div>
          )}
        </div>

        {/* Card area */}
        <div className="flex-1 min-w-0 py-2">
          <div
            className={`p-3 rounded-xl border transition-all ${
              isAnchor
                ? "bg-[var(--gold,#f59e0b)]/5 border-[var(--gold,#f59e0b)]/20"
                : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"
            } ${isDragging ? "ring-1 ring-[var(--neon-cyan)]/30 shadow-lg" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              {/* Drag handle for non-anchor stops */}
              {!isAnchor && (
                <button
                  className="shrink-0 touch-none p-0.5 -ml-1 text-white/15 hover:text-white/40 cursor-grab active:cursor-grabbing transition-colors"
                  {...attributes}
                  {...listeners}
                >
                  <DotsSixVertical size={16} />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{title}</p>
                {"event" in item && item.event?.venue_name && (
                  <p className="text-xs text-white/40 mt-0.5 truncate">
                    {(item.event as { venue_name?: string }).venue_name}
                  </p>
                )}
                {"venue" in item && item.venue?.neighborhood && (
                  <p className="text-xs text-white/40 mt-0.5 truncate">
                    {item.venue.neighborhood}
                  </p>
                )}
                {item.item_type === "custom" && item.custom_description && (
                  <p className="text-xs text-white/40 mt-0.5 truncate">
                    {item.custom_description}
                  </p>
                )}
              </div>
              {!isAnchor && (
                <button
                  onClick={() => onRemove(item.id)}
                  disabled={saving}
                  className="p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  <Trash size={14} />
                </button>
              )}
            </div>

            {/* Duration chip */}
            <div className="flex items-center gap-2 mt-2">
              <span
                className="px-2 py-0.5 rounded text-[10px]"
                style={{
                  fontFamily: "var(--font-mono)",
                  background: `${accentColor}0D`,
                  color: `${accentColor}BB`,
                }}
              >
                {item.duration_minutes} min
              </span>
              {isAnchor && (
                <span className="flex items-center gap-1 text-[9px] text-white/30" style={{ fontFamily: "var(--font-mono)" }}>
                  <Star size={8} weight="fill" className="text-[var(--gold)]" /> Anchor
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function PlaybookEditor({ itineraryId, portalId, portalSlug, portalName }: PlaybookEditorProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const {
    activeItinerary,
    loading,
    saving,
    loadItinerary,
    updateItinerary,
    deleteItinerary,
    addItem,
    removeItem,
    reorderItems,
    getShareUrl,
  } = useItinerary(portalId, portalSlug);

  const [mapExpanded, setMapExpanded] = useState(true);
  const [showAddStop, setShowAddStop] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // DnD sensors: pointer needs 8px distance, touch needs 200ms delay
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 8 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  // Load itinerary on mount
  useEffect(() => {
    loadItinerary(itineraryId);
  }, [itineraryId, loadItinerary]);

  const items = useMemo((): (ItineraryItem | LocalItineraryItem)[] => {
    if (!activeItinerary) return [];
    if ("items" in activeItinerary && Array.isArray(activeItinerary.items)) {
      return activeItinerary.items;
    }
    return [];
  }, [activeItinerary]);

  const itemIds = useMemo(() => items.map((i) => i.id), [items]);

  // Find anchor (first item with coords)
  const anchorItem = items[0] || null;
  const anchorCoords = anchorItem ? getItemCoords(anchorItem) : null;
  const anchorTime = anchorItem && "start_time" in anchorItem ? anchorItem.start_time : null;

  const handleShare = useCallback(async () => {
    if (!user) {
      showToast("Sign in to share your playbook", "info");
      return;
    }
    const ok = await updateItinerary({ is_public: true });
    if (!ok) {
      showToast("Failed to share playbook", "error");
      return;
    }
    const url = getShareUrl();
    if (url) {
      await navigator.clipboard.writeText(url);
      showToast("Share link copied!", "success");
    } else {
      showToast("Share link not available yet — try again", "error");
    }
  }, [user, updateItinerary, getShareUrl, showToast]);

  const handleDelete = useCallback(async () => {
    if (!activeItinerary) return;
    setConfirmDelete(false);
    const ok = await deleteItinerary(activeItinerary.id);
    if (ok) {
      router.push(`/${portalSlug}/playbook`);
    } else {
      showToast("Failed to delete playbook", "error");
    }
  }, [activeItinerary, deleteItinerary, portalSlug, router, showToast]);

  const handleSaveTitle = useCallback(async () => {
    if (titleDraft.trim()) {
      const ok = await updateItinerary({ title: titleDraft.trim() });
      if (!ok) showToast("Failed to update title", "error");
    }
    setEditingTitle(false);
  }, [titleDraft, updateItinerary, showToast]);

  const handleAddItem = useCallback(
    async (input: AddItineraryItemInput) => {
      const ok = await addItem(input);
      if (!ok) showToast("Failed to add stop", "error");
    },
    [addItem, showToast],
  );

  const handleRemoveItem = useCallback(
    async (itemId: string) => {
      const ok = await removeItem(itemId);
      if (!ok) showToast("Failed to remove stop", "error");
    },
    [removeItem, showToast],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);

      // Prevent dragging to position 0 (anchor is immovable)
      if (newIndex === 0) return;

      const reordered = arrayMove(items, oldIndex, newIndex);
      const newIds = reordered.map((i) => i.id);
      const ok = await reorderItems(newIds);
      if (!ok) showToast("Failed to reorder stops", "error");
    },
    [items, reorderItems, showToast],
  );

  // Compute total walk distance
  const totalWalkMeters = useMemo(
    () => items.reduce((s, item) => s + (item.walk_distance_meters || 0), 0),
    [items],
  );

  // Loading state
  if (loading && !activeItinerary) {
    return (
      <div className="min-h-screen bg-[var(--void)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  if (!activeItinerary) {
    return (
      <div className="min-h-screen bg-[var(--void)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/40 mb-4">Playbook not found</p>
          <Link href={`/${portalSlug}/playbook`} className="text-sm text-[var(--gold)] hover:underline">
            Back to playbooks
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative" style={{ background: "var(--void)" }}>
      {/* Atmospheric background */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: `
            radial-gradient(ellipse at 20% 0%, rgba(0, 212, 232, 0.025), transparent 50%),
            radial-gradient(ellipse at 80% 100%, rgba(255, 217, 61, 0.015), transparent 40%)
          `,
        }}
      />

      {/* Header */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          background: "rgba(9, 9, 11, 0.82)",
          backdropFilter: "blur(20px) saturate(180%)",
          borderColor: "rgba(37, 37, 48, 0.6)",
        }}
      >
        {/* Portal back-link breadcrumb */}
        <div className="max-w-5xl mx-auto px-4 pt-2 pb-0">
          <Link
            href={`/${portalSlug}`}
            className="inline-flex items-center gap-1 text-[11px] transition-colors hover:text-white/60"
            style={{ color: "rgba(255,255,255,0.28)", fontFamily: "var(--font-mono)" }}
          >
            <ArrowLeft size={10} weight="bold" />
            {portalName || "Home"}
          </Link>
        </div>

        <div className="max-w-5xl mx-auto flex items-center gap-3 px-4 py-2">
          <Link
            href={`/${portalSlug}/playbook`}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/[0.04] text-[var(--muted)]"
          >
            <ArrowLeft size={20} />
          </Link>

          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveTitle()}
                  className="bg-transparent text-[15px] font-semibold text-[var(--cream)] outline-none border-b border-[var(--gold)]/50 w-full"
                  autoFocus
                />
                <button onClick={handleSaveTitle} className="text-[var(--gold)] p-1">
                  <Check size={16} weight="bold" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { if (!activeItinerary) return; setTitleDraft(activeItinerary.title); setEditingTitle(true); }}
                className="group flex items-center gap-1.5"
              >
                <h1
                  className="text-[15px] font-semibold truncate"
                  style={{ color: "var(--cream)", fontFamily: "var(--font-outfit)" }}
                >
                  {activeItinerary.title}
                </h1>
                <PencilSimple size={12} className="text-white/20 group-hover:text-white/50 transition-colors" />
              </button>
            )}
            <p className="text-[10px]" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
              {activeItinerary.date ? new Date(activeItinerary.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase() : "NO DATE"} · {items.length} STOP{items.length !== 1 ? "S" : ""}{totalWalkMeters > 0 ? ` · ${formatWalkDistance(totalWalkMeters)}` : ""}
            </p>
          </div>

          {saving && (
            <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin shrink-0" />
          )}

          <button
            onClick={handleShare}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all hover:bg-[var(--gold)]/15"
            style={{
              color: "var(--gold)",
              border: "1px solid rgba(255, 217, 61, 0.25)",
              background: "rgba(255, 217, 61, 0.06)",
            }}
          >
            <ShareNetwork size={13} />
            Share
          </button>
        </div>
      </header>

      {/* Two-column layout */}
      <div className="relative z-10 max-w-5xl mx-auto lg:flex lg:gap-0">
        {/* LEFT: Timeline */}
        <main className="flex-1 lg:max-w-xl px-4 pt-4 pb-32">
          {/* Mobile map toggle */}
          <div className="lg:hidden mb-5">
            <button
              onClick={() => setMapExpanded(!mapExpanded)}
              className="flex items-center gap-1.5 mb-2 transition-colors hover:opacity-80 text-[var(--muted)]"
            >
              <MapTrifold size={13} className="opacity-40" />
              <span className="text-[11px] font-medium" style={{ fontFamily: "var(--font-outfit)" }}>
                {mapExpanded ? "Hide route" : "Show route"}
              </span>
              <CaretDown
                size={10}
                style={{
                  transform: mapExpanded ? "rotate(0)" : "rotate(-90deg)",
                  transition: "transform 0.3s ease",
                }}
              />
            </button>
            {mapExpanded && <PlaybookMap items={items} className="rounded-xl h-[180px] border border-white/[0.04]" />}
          </div>

          {/* Cold start — guided onboarding when no stops */}
          {items.length === 0 && !loading && (
            <div className="py-6">
              <div className="text-center mb-6">
                <div
                  className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, rgba(255, 217, 61, 0.1), rgba(0, 212, 232, 0.08))",
                    border: "1px solid rgba(255, 217, 61, 0.15)",
                  }}
                >
                  <Notebook size={24} weight="light" className="text-[var(--gold)]" />
                </div>
                <h2
                  className="text-base font-semibold mb-1"
                  style={{ color: "var(--cream)", fontFamily: "var(--font-outfit)" }}
                >
                  Add your first stop
                </h2>
                <p className="text-xs text-white/35 max-w-xs mx-auto">
                  Search for an event, venue, or add a custom stop to start building your playbook
                </p>
              </div>
              <AddStopPanel
                portalSlug={portalSlug}
                onAddItem={handleAddItem}
              />
            </div>
          )}

          {/* Timeline with DnD */}
          {items.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                <div className="relative">
                  {/* Spine line with shimmer */}
                  <div
                    className="absolute left-[27px] top-4 bottom-4 w-px overflow-hidden"
                    style={{
                      background: `linear-gradient(to bottom,
                        transparent 0%,
                        rgba(0, 212, 232, 0.12) 6%,
                        rgba(0, 212, 232, 0.18) 30%,
                        rgba(255, 217, 61, 0.14) 50%,
                        rgba(0, 212, 232, 0.18) 70%,
                        rgba(0, 212, 232, 0.12) 94%,
                        transparent 100%
                      )`,
                    }}
                  >
                    <div
                      className="absolute inset-0 w-full animate-pulse"
                      style={{
                        background: `linear-gradient(to bottom, transparent 0%, rgba(255, 217, 61, 0.3) 50%, transparent 100%)`,
                        backgroundSize: "100% 200%",
                        animation: "spine-shimmer 4s ease-in-out infinite",
                      }}
                    />
                  </div>

                  {items.map((item, idx) => (
                    <SortableStop
                      key={item.id}
                      item={item}
                      idx={idx}
                      items={items}
                      saving={saving}
                      onRemove={handleRemoveItem}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Add a Stop Panel (shown after at least one stop exists) */}
          {items.length > 0 && (
            <div className="mt-8 pt-4 border-t border-white/[0.06]">
              <button
                onClick={() => setShowAddStop(!showAddStop)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-white/50 hover:text-white/80 hover:bg-white/[0.03] transition-all mb-3"
                style={{ border: "1px dashed rgba(255, 255, 255, 0.08)" }}
              >
                <Plus size={15} className="text-[var(--gold)]" />
                Add a stop
                <CaretDown
                  size={12}
                  className="text-white/30"
                  style={{
                    transform: showAddStop ? "rotate(0)" : "rotate(-90deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </button>

              {showAddStop && (
                <AddStopPanel
                  portalSlug={portalSlug}
                  anchorLat={anchorCoords?.lat}
                  anchorLng={anchorCoords?.lng}
                  anchorTime={anchorTime || undefined}
                  anchorDate={activeItinerary.date || undefined}
                  onAddItem={handleAddItem}
                />
              )}
            </div>
          )}

          {/* Danger zone: delete */}
          <div className="mt-16 pt-6 border-t border-white/[0.08]">
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 text-xs text-red-400/60 hover:text-red-400 transition-colors"
              >
                <Trash size={14} />
                Delete this playbook
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs text-red-400">Delete this playbook?</span>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1 rounded-md text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1 rounded-md text-xs text-white/40 hover:text-white/60 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </main>

        {/* RIGHT: Map sidebar (desktop) */}
        <aside className="hidden lg:block lg:w-[400px] lg:shrink-0">
          <div className="sticky top-[57px] h-[calc(100vh-57px)] border-l" style={{ borderColor: "rgba(37, 37, 48, 0.4)" }}>
            <PlaybookMap items={items} className="h-full" />
          </div>
        </aside>
      </div>
    </div>
  );
}
