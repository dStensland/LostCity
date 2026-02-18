"use client";

import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { EventWithLocation } from "@/lib/search";
import type { Spot } from "@/lib/spots-constants";
import MapListItem from "./MapListItem";

interface MapListDrawerProps {
  events: EventWithLocation[];
  spots: Spot[];
  isLoading?: boolean;
  selectedItemId?: number | null;
  onItemSelect: (item: { type: "event" | "spot"; id: number } | null) => void;
  onItemHover: (id: number | null) => void;
}

// Flat list item — either a section header or a data row
type FlatItem =
  | { kind: "header"; label: string; count: number }
  | { kind: "event"; event: EventWithLocation }
  | { kind: "spot"; spot: Spot };

const ROW_HEIGHT = 88;
const HEADER_HEIGHT = 36;
const VIRTUALIZE_THRESHOLD = 60;

export default function MapListDrawer({
  events,
  spots,
  isLoading,
  selectedItemId,
  onItemSelect,
  onItemHover,
}: MapListDrawerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  // Flatten events + spots into a single list with section headers
  const flatItems = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = [];
    const hasEvents = events.length > 0;
    const hasSpots = spots.length > 0;

    if (hasEvents) {
      if (hasSpots) items.push({ kind: "header", label: "Events", count: events.length });
      events.forEach((event) => items.push({ kind: "event", event }));
    }
    if (hasSpots) {
      if (hasEvents) items.push({ kind: "header", label: "Destinations", count: spots.length });
      spots.forEach((spot) => items.push({ kind: "spot", spot }));
    }

    return items;
  }, [events, spots]);

  const totalCount = events.length + spots.length;
  const useVirtual = totalCount > VIRTUALIZE_THRESHOLD;

  // Virtual list
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: useVirtual ? flatItems.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => flatItems[index]?.kind === "header" ? HEADER_HEIGHT : ROW_HEIGHT,
    overscan: 8,
  });

  // Keyboard navigation state
  const [focusIndex, setFocusIndex] = useState(-1);

  // Get all selectable item IDs for keyboard nav
  const selectableItems = useMemo(() => {
    return flatItems
      .map((item, idx) => {
        if (item.kind === "event") return { idx, type: "event" as const, id: item.event.id };
        if (item.kind === "spot") return { idx, type: "spot" as const, id: item.spot.id };
        return null;
      })
      .filter(Boolean) as { idx: number; type: "event" | "spot"; id: number }[];
  }, [flatItems]);

  // Keyboard handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (selectableItems.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = focusIndex < selectableItems.length - 1 ? focusIndex + 1 : 0;
        setFocusIndex(next);
        onItemHover(selectableItems[next].id);
        if (useVirtual) virtualizer.scrollToIndex(selectableItems[next].idx, { align: "auto" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = focusIndex > 0 ? focusIndex - 1 : selectableItems.length - 1;
        setFocusIndex(prev);
        onItemHover(selectableItems[prev].id);
        if (useVirtual) virtualizer.scrollToIndex(selectableItems[prev].idx, { align: "auto" });
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (focusIndex >= 0 && focusIndex < selectableItems.length) {
          const item = selectableItems[focusIndex];
          onItemSelect({ type: item.type, id: item.id });
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setFocusIndex(-1);
        onItemHover(null);
        onItemSelect(null);
      }
    },
    [focusIndex, selectableItems, onItemHover, onItemSelect, useVirtual, virtualizer]
  );

  const handleDrawerFocus = useCallback(() => {
    if (selectableItems.length === 0 || focusIndex >= 0) return;
    setFocusIndex(0);
    onItemHover(selectableItems[0].id);
  }, [focusIndex, selectableItems, onItemHover]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (selectedItemId == null) return;
    if (useVirtual) {
      const idx = flatItems.findIndex((item) => {
        if (item.kind === "event") return item.event.id === selectedItemId;
        if (item.kind === "spot") return item.spot.id === selectedItemId;
        return false;
      });
      if (idx >= 0) virtualizer.scrollToIndex(idx, { align: "auto" });
    } else if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedItemId, useVirtual, flatItems, virtualizer]);

  // Render a single row
  function renderItem(item: FlatItem, key: string) {
    if (item.kind === "header") {
      return (
        <div key={key} className="flex items-center gap-2 px-4 pt-3 pb-1.5" aria-hidden="true">
          <span className="font-mono text-[11px] font-semibold text-[var(--soft)] uppercase tracking-widest">
            {item.label}
          </span>
          <span className="font-mono text-[11px] text-[var(--muted)]">{item.count}</span>
          <div className="flex-1 h-px bg-gradient-to-r from-[var(--twilight)] to-transparent" />
        </div>
      );
    }
    if (item.kind === "event") {
      const isSelected = item.event.id === selectedItemId;
      return (
        <div key={key} ref={!useVirtual && isSelected ? selectedRef : undefined} className="py-0.5">
          <MapListItem
            id={item.event.id}
            type="event"
            optionId={`map-item-event-${item.event.id}`}
            title={item.event.title}
            category={item.event.venue?.venue_type || item.event.category}
            venueName={item.event.venue?.name || null}
            neighborhood={item.event.venue?.neighborhood || null}
            startDate={item.event.start_date}
            startTime={item.event.start_time}
            isAllDay={item.event.is_all_day}
            isFree={item.event.is_free}
            isLive={item.event.is_live}
            isSelected={isSelected}
            onSelect={onItemSelect}
            onHover={onItemHover}
          />
        </div>
      );
    }
    // spot
    const isSelected = item.spot.id === selectedItemId;
    return (
      <div key={key} ref={!useVirtual && isSelected ? selectedRef : undefined} className="py-0.5">
        <MapListItem
          id={item.spot.id}
          type="spot"
          optionId={`map-item-spot-${item.spot.id}`}
          title={item.spot.name}
          category={item.spot.venue_type}
          venueName={null}
          neighborhood={item.spot.neighborhood}
          isSelected={isSelected}
          onSelect={onItemSelect}
          onHover={onItemHover}
        />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full bg-gradient-to-b from-[var(--night)] to-[var(--void)] border-r border-[var(--twilight)] focus-within:ring-1 focus-within:ring-[var(--coral)]/50"
      role="region"
      aria-label="Events and destinations in view"
      aria-describedby="map-drawer-keyboard-hint"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={handleDrawerFocus}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--twilight)]/80 bg-[var(--void)]/92 backdrop-blur-md">
        <span className="font-mono text-[11px] font-semibold text-[var(--soft)] uppercase tracking-widest">
          In view
        </span>
        <div className="flex items-center gap-2">
          {isLoading && totalCount > 0 && (
            <div className="w-3 h-3 rounded-full border-2 border-[var(--coral)] border-t-transparent animate-spin" />
          )}
          <span className="font-mono text-sm font-bold text-[var(--cream)] bg-[var(--dusk)] px-2.5 py-0.5 rounded-full min-w-[28px] text-center border border-[var(--twilight)]/75" aria-live="polite">
            {totalCount}
          </span>
        </div>
      </div>
      <span id="map-drawer-keyboard-hint" className="sr-only">
        Use arrow keys to browse map items, enter to select, and escape to clear selection.
      </span>

      {/* Scrollable list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-2 py-1.5" role="listbox" aria-label="Map items">
        {totalCount === 0 && isLoading ? (
          /* Loading state */
          <div className="flex flex-col items-center justify-center h-full px-6">
            <div className="w-5 h-5 rounded-full border-2 border-[var(--coral)] border-t-transparent animate-spin mb-3" />
            <p className="text-xs text-[var(--muted)] font-mono text-center">
              Loading events
            </p>
          </div>
        ) : totalCount === 0 ? (
          /* Rich empty state */
          <div className="flex flex-col items-center justify-center h-full px-6">
            <div className="w-12 h-12 rounded-full bg-[var(--coral)]/10 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <p className="text-sm text-[var(--cream)] font-medium mb-1">Nothing in view</p>
            <p className="text-xs text-[var(--muted)] font-mono text-center leading-relaxed">
              Zoom out or pan the map to discover more
            </p>
          </div>
        ) : useVirtual ? (
          /* Virtualized list for 60+ items */
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = flatItems[virtualRow.index];
              const key = item.kind === "header" ? `header-${item.label}` :
                item.kind === "event" ? `e-${item.event.id}` : `s-${item.spot.id}`;
              return (
                <div
                  key={key}
                  className="absolute top-0 left-0 w-full"
                  style={{ height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}
                >
                  {renderItem(item, key)}
                </div>
              );
            })}
          </div>
        ) : (
          /* Standard list for <60 items */
          <div className="px-2 py-2">
            {flatItems.map((item) => {
              const key = item.kind === "header" ? `header-${item.label}` :
                item.kind === "event" ? `e-${item.event.id}` : `s-${item.spot.id}`;
              return renderItem(item, key);
            })}
          </div>
        )}
      </div>
    </div>
  );
}
