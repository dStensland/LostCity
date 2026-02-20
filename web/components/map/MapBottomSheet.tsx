"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import type { EventWithLocation } from "@/lib/search";
import type { Spot } from "@/lib/spots-constants";
import { getCategoryColor } from "@/lib/category-config";
import { decodeHtmlEntities, formatTime } from "@/lib/formats";
import MapListItem from "./MapListItem";

interface MapBottomSheetProps {
  events: EventWithLocation[];
  spots: Spot[];
  isLoading?: boolean;
  selectedItemId?: number | null;
  onItemSelect: (item: { type: "event" | "spot"; id: number } | null) => void;
  onItemHover: (id: number | null) => void;
}

// Snap points as vh percentages.
const SNAP_COLLAPSED = 20;
const SNAP_HALF = 56;
const SNAP_FULL = 90;
const PREVIEW_LIMIT = 3;

export default function MapBottomSheet({
  events,
  spots,
  isLoading,
  selectedItemId,
  onItemSelect,
  onItemHover,
}: MapBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const didDragRef = useRef(false);
  const [heightVh, setHeightVh] = useState(SNAP_COLLAPSED);
  const [isDragging, setIsDragging] = useState(false);
  const totalCount = events.length + spots.length;
  const isCollapsed = heightVh <= SNAP_COLLAPSED + 4;
  const isHalfOpen = heightVh > SNAP_COLLAPSED + 4 && heightVh < SNAP_FULL - 4;

  const snapTo = useCallback((vh: number) => {
    const dists = [
      { snap: SNAP_COLLAPSED, d: Math.abs(vh - SNAP_COLLAPSED) },
      { snap: SNAP_HALF, d: Math.abs(vh - SNAP_HALF) },
      { snap: SNAP_FULL, d: Math.abs(vh - SNAP_FULL) },
    ];
    dists.sort((a, b) => a.d - b.d);
    setHeightVh(dists[0].snap);
  }, []);

  const cycleSnapPoint = useCallback(() => {
    if (isCollapsed) {
      setHeightVh(SNAP_HALF);
      return;
    }
    if (isHalfOpen) {
      setHeightVh(SNAP_FULL);
      return;
    }
    setHeightVh(SNAP_COLLAPSED);
  }, [isCollapsed, isHalfOpen]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragRef.current = { startY: touch.clientY, startHeight: heightVh };
    didDragRef.current = false;
    setIsDragging(true);
  }, [heightVh]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const deltaY = dragRef.current.startY - touch.clientY;
    const deltaVh = (deltaY / window.innerHeight) * 100;
    if (Math.abs(deltaVh) > 1) didDragRef.current = true;
    const newHeight = Math.min(SNAP_FULL, Math.max(SNAP_COLLAPSED - 6, dragRef.current.startHeight + deltaVh));
    setHeightVh(newHeight);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsDragging(false);
    snapTo(heightVh);
  }, [heightVh, snapTo]);

  const handleHeaderClick = useCallback(() => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    cycleSnapPoint();
  }, [cycleSnapPoint]);

  // Auto-expand when an item is selected from the map.
  useEffect(() => {
    if (selectedItemId != null && isCollapsed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional UX behavior when a map pin is selected.
      setHeightVh(SNAP_HALF);
    }
  }, [selectedItemId, isCollapsed]);

  const previewItems = useMemo(() => {
    const eventCards = events.slice(0, PREVIEW_LIMIT).map((event) => ({
      type: "event" as const,
      id: event.id,
      title: decodeHtmlEntities(event.title),
      subtitle: [event.venue?.name ? decodeHtmlEntities(event.venue.name) : null, formatTime(event.start_time ?? null, event.is_all_day)].filter(Boolean).join(" · "),
      accent: getCategoryColor(event.venue?.venue_type || event.category || "other"),
    }));

    const openSlots = PREVIEW_LIMIT - eventCards.length;
    if (openSlots <= 0) return eventCards;

    const spotCards = spots.slice(0, openSlots).map((spot) => ({
      type: "spot" as const,
      id: spot.id,
      title: decodeHtmlEntities(spot.name),
      subtitle: spot.neighborhood ? decodeHtmlEntities(spot.neighborhood) : "Spot",
      accent: getCategoryColor(spot.venue_type || "other"),
    }));

    return [...eventCards, ...spotCards];
  }, [events, spots]);

  return (
    <div
      ref={sheetRef}
      className={`absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-b from-[var(--night)] to-[var(--void)] border-t border-[var(--twilight)] rounded-t-2xl shadow-[0_-12px_34px_rgba(0,0,0,0.52)] backdrop-blur-md ${
        isDragging ? "" : "transition-[height] duration-300 ease-out motion-reduce:duration-0"
      }`}
      style={{ height: `${heightVh}vh`, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <button
        className="w-full touch-none select-none"
        type="button"
        onClick={handleHeaderClick}
        aria-label={isCollapsed ? "Expand list" : "Change list size"}
      >
        <div
          className="flex flex-col items-center justify-center h-7 cursor-grab active:cursor-grabbing pt-2"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          role="separator"
          aria-label="Drag to resize list"
          aria-orientation="horizontal"
        >
          <div className="w-10 h-1 rounded-full bg-[var(--twilight)]" />
        </div>
        <div className="flex items-center justify-between px-4 py-1.5">
          <span className="font-mono text-[11px] font-semibold text-[var(--soft)] uppercase tracking-widest">
            In view
          </span>
          <div className="flex items-center gap-2">
            {isLoading && totalCount > 0 && (
              <div className="w-3 h-3 rounded-full border-2 border-[var(--coral)] border-t-transparent animate-spin" />
            )}
            {totalCount > 0 && (
              <span className="font-mono text-xs font-bold text-[var(--cream)] bg-[var(--twilight)] px-2.5 py-0.5 rounded-full min-w-[28px] text-center">
                {totalCount}
              </span>
            )}
            <svg
              className={`w-4 h-4 text-[var(--muted)] transition-transform ${
                isCollapsed ? "" : isHalfOpen ? "rotate-180" : "rotate-[270deg]"
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </div>
        </div>
      </button>

      {/* Collapsed state: richer in-view preview. */}
      {isCollapsed && (
        <div className="px-4 pb-2.5">
          {totalCount === 0 && isLoading ? (
            <div className="flex items-center justify-center gap-2 py-1">
              <div className="w-3 h-3 rounded-full border-2 border-[var(--coral)] border-t-transparent animate-spin" />
              <span className="text-xs text-[var(--muted)] font-mono">Loading events</span>
            </div>
          ) : totalCount === 0 ? (
            <p className="text-xs text-[var(--muted)] font-mono text-center py-1">
              Zoom out or pan to discover more
            </p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x snap-proximity">
              {previewItems.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  className="snap-start min-w-[200px] max-w-[236px] flex-1 flex items-start gap-2.5 p-3 bg-[var(--twilight)]/36 border border-[var(--twilight)]/80 rounded-xl text-left active:bg-[var(--twilight)]/65 transition-colors"
                  onClick={() => onItemSelect({ type: item.type, id: item.id })}
                >
                  <span
                    className="w-[10px] h-[10px] mt-1 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.accent }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--cream)] truncate">{item.title}</p>
                    <p className="text-[11px] text-[var(--muted)] truncate">{item.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {totalCount > previewItems.length && (
            <p className="text-[10px] text-[var(--muted)] font-mono text-center mt-1.5">
              +{totalCount - previewItems.length} more
            </p>
          )}
        </div>
      )}

      {/* Expanded: full scrollable list. */}
      {!isCollapsed && (
        <>
          <div className="border-t border-[var(--twilight)]/50" />
          <div
            className="overflow-y-auto overscroll-contain p-3"
            style={{
              height: `calc(${heightVh}vh - 90px)`,
              WebkitOverflowScrolling: "touch",
            }}
            role="listbox"
            aria-label="Map items"
          >
            {totalCount === 0 && isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 px-4">
                <div className="w-4 h-4 rounded-full border-2 border-[var(--coral)] border-t-transparent animate-spin mb-2" />
                <p className="text-xs text-[var(--muted)] font-mono text-center">
                  Loading events
                </p>
              </div>
            ) : totalCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4">
                <div className="w-10 h-10 rounded-full bg-[var(--coral)]/10 flex items-center justify-center mb-2">
                  <svg className="w-5 h-5 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <p className="text-xs text-[var(--muted)] font-mono text-center">
                  Zoom out or pan to discover more
                </p>
              </div>
            ) : (
              <>
                {events.map((event) => (
                  <div key={`e-${event.id}`} className="py-1">
                    <MapListItem
                      id={event.id}
                      type="event"
                      title={event.title}
                      category={event.venue?.venue_type || event.category}
                      venueName={event.venue?.name || null}
                      neighborhood={event.venue?.neighborhood || null}
                      startDate={event.start_date}
                      startTime={event.start_time}
                      isAllDay={event.is_all_day}
                      isFree={event.is_free}
                      isLive={event.is_live}
                      isSelected={event.id === selectedItemId}
                      onSelect={onItemSelect}
                      onHover={onItemHover}
                    />
                  </div>
                ))}
                {spots.length > 0 && events.length > 0 && (
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1.5" aria-hidden="true">
                    <span className="font-mono text-[10px] font-semibold text-[var(--soft)] uppercase tracking-widest">
                      Spots
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-r from-[var(--twilight)] to-transparent" />
                  </div>
                )}
                {spots.map((spot) => (
                  <div key={`s-${spot.id}`} className="py-1">
                    <MapListItem
                      id={spot.id}
                      type="spot"
                      title={spot.name}
                      category={spot.venue_type}
                      venueName={null}
                      neighborhood={spot.neighborhood}
                      isSelected={spot.id === selectedItemId}
                      onSelect={onItemSelect}
                      onHover={onItemHover}
                    />
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
