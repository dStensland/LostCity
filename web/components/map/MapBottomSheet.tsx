"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { EventWithLocation } from "@/lib/search";
import type { Spot } from "@/lib/spots-constants";
import { getMapPinColor } from "@/lib/category-config";
import { formatTime, getEventStatus } from "@/lib/formats";
import MapListItem from "./MapListItem";

interface MapBottomSheetProps {
  events: EventWithLocation[];
  spots: Spot[];
  isLoading?: boolean;
  selectedItemId?: number | null;
  onItemSelect: (item: { type: "event" | "spot"; id: number } | null) => void;
  onItemHover: (id: number | null) => void;
}

// Snap points as vh percentages
const SNAP_COLLAPSED = 18; // Pill + header + preview card
const SNAP_HALF = 50;
const SNAP_FULL = 88;

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
  const [heightVh, setHeightVh] = useState(SNAP_COLLAPSED);
  const [isDragging, setIsDragging] = useState(false);
  const totalCount = events.length + spots.length;

  // Snap to nearest snap point
  const snapTo = useCallback((vh: number) => {
    const dists = [
      { snap: SNAP_COLLAPSED, d: Math.abs(vh - SNAP_COLLAPSED) },
      { snap: SNAP_HALF, d: Math.abs(vh - SNAP_HALF) },
      { snap: SNAP_FULL, d: Math.abs(vh - SNAP_FULL) },
    ];
    dists.sort((a, b) => a.d - b.d);
    setHeightVh(dists[0].snap);
  }, []);

  // Touch drag handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragRef.current = { startY: touch.clientY, startHeight: heightVh };
    setIsDragging(true);
  }, [heightVh]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current) return;
    const touch = e.touches[0];
    const deltaY = dragRef.current.startY - touch.clientY;
    const deltaVh = (deltaY / window.innerHeight) * 100;
    const newHeight = Math.min(SNAP_FULL, Math.max(10, dragRef.current.startHeight + deltaVh));
    setHeightVh(newHeight);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsDragging(false);
    snapTo(heightVh);
  }, [heightVh, snapTo]);

  // Click the handle to toggle between collapsed and half
  const handleToggle = useCallback(() => {
    if (heightVh <= SNAP_COLLAPSED + 5) {
      setHeightVh(SNAP_HALF);
    } else {
      setHeightVh(SNAP_COLLAPSED);
    }
  }, [heightVh]);

  // Auto-expand when an item is selected from the map
  useEffect(() => {
    if (selectedItemId != null && heightVh <= SNAP_COLLAPSED + 5) {
      setHeightVh(SNAP_HALF);
    }
  }, [selectedItemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isExpanded = heightVh > SNAP_COLLAPSED + 5;

  // Preview card data — first event for collapsed state
  const previewEvent = events[0] ?? null;
  const previewColor = previewEvent ? getMapPinColor(previewEvent.venue?.venue_type || previewEvent.category || "other") : null;
  const previewTime = previewEvent ? formatTime(previewEvent.start_time ?? null, previewEvent.is_all_day) : null;
  const previewStatus = previewEvent ? getEventStatus(previewEvent.start_date, previewEvent.start_time, previewEvent.is_all_day, previewEvent.is_live) : null;

  return (
    <div
      ref={sheetRef}
      className={`absolute bottom-0 left-0 right-0 z-10 bg-[var(--night)] border-t border-[var(--twilight)] rounded-t-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.5)] ${
        isDragging ? "" : "transition-[height] duration-300 ease-out motion-reduce:duration-0"
      }`}
      style={{ height: `${heightVh}vh` }}
    >
      {/* Drag handle — drag-only, no click toggle */}
      <div
        className="flex flex-col items-center justify-center h-6 cursor-grab active:cursor-grabbing touch-none pt-2"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="separator"
        aria-label="Drag to resize list"
        aria-orientation="horizontal"
      >
        <div className="w-10 h-1 rounded-full bg-[var(--twilight)]" />
      </div>

      {/* Tap target to toggle expand/collapse */}
      <button
        className="w-full flex items-center justify-between px-5 py-1.5"
        onClick={handleToggle}
        aria-label={isExpanded ? "Collapse list" : "Expand list"}
      >
        <span className="font-mono text-[11px] font-semibold text-[var(--soft)] uppercase tracking-widest">
          {isExpanded ? "In view" : totalCount > 0 ? `${totalCount} nearby` : "Events"}
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
          <svg className={`w-4 h-4 text-[var(--muted)] transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </div>
      </button>

      {/* Collapsed state: preview card */}
      {!isExpanded && (
        <div className="px-4 pb-2">
          {totalCount === 0 && isLoading ? (
            <div className="flex items-center justify-center gap-2 py-1">
              <div className="w-3 h-3 rounded-full border-2 border-[var(--coral)] border-t-transparent animate-spin" />
              <span className="text-xs text-[var(--muted)] font-mono">Loading events</span>
            </div>
          ) : totalCount === 0 ? (
            <p className="text-xs text-[var(--muted)] font-mono text-center py-1">
              Zoom out or pan to discover more
            </p>
          ) : previewEvent ? (
            <button
              className="w-full flex items-center gap-3 p-2.5 bg-[var(--twilight)]/40 rounded-xl text-left active:bg-[var(--twilight)]/60"
              onClick={() => onItemSelect({ type: "event", id: previewEvent.id })}
            >
              <span
                className="w-[10px] h-[10px] rounded-full flex-shrink-0"
                style={{ backgroundColor: previewColor! }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--cream)] truncate">{previewEvent.title}</p>
                <p className="text-[11px] text-[var(--muted)] truncate">
                  {previewEvent.venue?.name || ""}
                  {previewEvent.venue?.name && previewTime ? " · " : ""}
                  {previewTime}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {previewStatus && (
                  <span
                    className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                    style={{ color: previewStatus.color, backgroundColor: `${previewStatus.color}20` }}
                  >
                    {previewStatus.label}
                  </span>
                )}
                {previewEvent.is_free && (
                  <span className="text-[10px] font-mono font-bold text-[var(--neon-green)] bg-[var(--neon-green)]/15 px-1.5 py-0.5 rounded">
                    Free
                  </span>
                )}
                {/* Chevron up hint */}
                <svg className="w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </div>
            </button>
          ) : spots.length > 0 ? (
            <div className="flex items-center justify-between px-1">
              <span className="font-mono text-[10px] text-[var(--muted)] uppercase tracking-wider">
                {spots.length} destination{spots.length !== 1 ? "s" : ""} nearby
              </span>
              <svg className="w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </div>
          ) : null}
          {totalCount > 1 && previewEvent && (
            <p className="text-[10px] text-[var(--muted)] font-mono text-center mt-1.5">
              +{totalCount - 1} more nearby
            </p>
          )}
        </div>
      )}

      {/* Expanded: full scrollable list */}
      {isExpanded && (
        <>
          <div className="border-t border-[var(--twilight)]/50" />
          <div
            className="overflow-y-auto overscroll-contain p-2"
            style={{ height: `calc(${heightVh}vh - 86px)` }}
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
                  <MapListItem
                    key={`e-${event.id}`}
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
                ))}
                {spots.length > 0 && events.length > 0 && (
                  <div className="flex items-center gap-2 px-3 pt-2 pb-1" aria-hidden="true">
                    <span className="font-mono text-[10px] font-semibold text-[var(--soft)] uppercase tracking-widest">
                      Destinations
                    </span>
                    <div className="flex-1 h-px bg-gradient-to-r from-[var(--twilight)] to-transparent" />
                  </div>
                )}
                {spots.map((spot) => (
                  <MapListItem
                    key={`s-${spot.id}`}
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
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
