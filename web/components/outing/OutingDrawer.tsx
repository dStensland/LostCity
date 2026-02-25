"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useItinerary } from "@/lib/hooks/useItinerary";
import { useToast } from "@/components/Toast";
import OutingSuggestions, { type Suggestion } from "./OutingSuggestions";
import { Star } from "@phosphor-icons/react/dist/ssr";
import {
  getItemTitle,
  formatItineraryTime,
  formatWalkTime,
  type AddItineraryItemInput,
} from "@/lib/itinerary-utils";

interface OutingDrawerProps {
  portalId: string;
  portalSlug: string;
  open: boolean;
  onClose: () => void;
  anchorEvent: {
    id: number;
    title: string;
    start_time: string | null;
    date: string;
    venue: { id: number; name: string; slug: string; lat: number | null; lng: number | null };
  } | null;
  onItemCountChange?: (count: number) => void;
}

export default function OutingDrawer({
  portalId,
  portalSlug,
  open,
  onClose,
  anchorEvent,
  onItemCountChange,
}: OutingDrawerProps) {
  const { showToast } = useToast();
  const {
    activeItinerary,
    loading,
    saving,
    createItinerary,
    addItem,
    removeItem,
  } = useItinerary(portalId, portalSlug);

  const [showSuggestions, setShowSuggestions] = useState(true);
  const [initError, setInitError] = useState(false);
  const initializedForRef = useRef<number | null>(null);

  // When an anchor event is set and drawer opens, create an itinerary with it
  useEffect(() => {
    if (!open || !anchorEvent) return;
    if (initializedForRef.current === anchorEvent.id) return;

    initializedForRef.current = anchorEvent.id;

    async function initOuting() {
      try {
        setInitError(false);
        const itinId = await createItinerary(
          portalId,
          `Outing: ${anchorEvent!.title}`,
          anchorEvent!.date,
        );
        if (itinId) {
          await addItem({
            item_type: "event",
            event_id: anchorEvent!.id,
            start_time: anchorEvent!.start_time || undefined,
          }, itinId);
        }
      } catch (err) {
        console.error("Failed to initialize outing:", err);
        setInitError(true);
        initializedForRef.current = null; // Allow retry
      }
    }

    initOuting();
  }, [open, anchorEvent, portalId, createItinerary, addItem]);

  const handleAddSuggestion = useCallback(
    async (suggestion: Suggestion) => {
      const input: AddItineraryItemInput = {
        item_type: suggestion.type === "event" ? "event" : "venue",
        ...(suggestion.type === "event"
          ? { event_id: suggestion.id }
          : { venue_id: suggestion.venue.id }),
        custom_lat: suggestion.venue.lat || undefined,
        custom_lng: suggestion.venue.lng || undefined,
      };
      const ok = await addItem(input);
      if (!ok) showToast("Failed to add stop", "error");
    },
    [addItem, showToast],
  );

  // Report item count to parent for FAB display
  const itemCount = activeItinerary && "items" in activeItinerary && Array.isArray(activeItinerary.items)
    ? activeItinerary.items.length
    : 0;
  useEffect(() => {
    onItemCountChange?.(itemCount);
  }, [itemCount, onItemCountChange]);

  if (!open) return null;

  const items = (() => {
    if (!activeItinerary) return [];
    if ("items" in activeItinerary && Array.isArray(activeItinerary.items)) {
      return activeItinerary.items;
    }
    return [];
  })();

  const hasAnchorCoords = anchorEvent?.venue.lat != null && anchorEvent?.venue.lng != null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-lg bg-[var(--bg-primary,#1a1a2e)] rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">
              {activeItinerary?.title || "Your Outing"}
            </h2>
            {anchorEvent && (
              <p className="text-xs text-white/40 mt-0.5">
                {items.length} stop{items.length !== 1 ? "s" : ""} planned
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          {/* Loading */}
          {loading && !initError && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          )}

          {/* Init error */}
          {initError && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <p className="text-sm text-red-400/80">Something went wrong</p>
              <button
                onClick={() => {
                  initializedForRef.current = null;
                  setInitError(false);
                }}
                className="text-xs text-white/50 hover:text-white/80 underline transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {/* Itinerary items */}
          {!loading && items.length > 0 && (
            <div className="space-y-1">
              {items.map((item, idx) => {
                const title = getItemTitle(item);
                const time = "start_time" in item ? formatItineraryTime(item.start_time) : "";
                const walkTime = "walk_time_minutes" in item ? formatWalkTime(item.walk_time_minutes) : "";
                const isAnchor = idx === 0 && anchorEvent;

                return (
                  <div key={item.id}>
                    {/* Walk time connector */}
                    {idx > 0 && walkTime && (
                      <div className="flex items-center gap-2 pl-5 py-1">
                        <div className="w-px h-4 bg-white/10" />
                        <span className="text-[10px] text-white/30 font-mono">{walkTime}</span>
                      </div>
                    )}

                    <div className={`flex items-center gap-3 p-2.5 rounded-lg ${
                      isAnchor
                        ? "bg-[var(--gold,#f59e0b)]/10 border border-[var(--gold,#f59e0b)]/30"
                        : "bg-white/5 border border-white/5"
                    }`}>
                      {/* Position indicator */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                        isAnchor
                          ? "bg-[var(--gold,#f59e0b)]/20 text-[var(--gold,#f59e0b)]"
                          : "bg-white/10 text-white/50"
                      }`}>
                        {isAnchor ? <Star size={14} weight="fill" /> : idx + 1}
                      </div>

                      {/* Item info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{title}</p>
                        {time && (
                          <p className="text-[10px] text-white/40 font-mono">{time}</p>
                        )}
                      </div>

                      {/* Remove button (not for anchor) */}
                      {!isAnchor && (
                        <button
                          onClick={async () => {
                            const ok = await removeItem(item.id);
                            if (!ok) showToast("Failed to remove stop", "error");
                          }}
                          disabled={saving}
                          className="p-1 rounded text-white/20 hover:text-white/60 hover:bg-white/5 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Suggestions section */}
          {anchorEvent && hasAnchorCoords && anchorEvent.start_time && (
            <div>
              <button
                onClick={() => setShowSuggestions(!showSuggestions)}
                className="flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white transition-colors mb-2"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showSuggestions ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                Suggestions nearby
              </button>

              {showSuggestions && (
                <OutingSuggestions
                  portalSlug={portalSlug}
                  anchorLat={anchorEvent.venue.lat!}
                  anchorLng={anchorEvent.venue.lng!}
                  anchorTime={anchorEvent.start_time}
                  anchorDate={anchorEvent.date}
                  onAddSuggestion={handleAddSuggestion}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
