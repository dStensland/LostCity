"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useItinerary } from "@/lib/hooks/useItinerary";
import type {
  ItineraryItem,
  LocalItineraryItem,
  AddItineraryItemInput,
} from "@/lib/itinerary-utils";
import type { OutingSuggestion } from "@/lib/outing-suggestions-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OutingPhase = "suggestions" | "planning";

export type AnchorInput =
  | {
      type: "event";
      event: {
        id: number;
        title: string;
        start_date: string;
        start_time: string | null;
        end_time: string | null;
        is_all_day?: boolean;
        category_id?: string | null;
        venue: {
          id: number;
          name: string;
          slug: string;
          lat: number | null;
          lng: number | null;
        } | null;
      };
    }
  | {
      type: "venue";
      venue: {
        id: number;
        name: string;
        slug: string;
        lat: number | null;
        lng: number | null;
      };
    };

export interface UseOutingPlannerReturn {
  phase: OutingPhase;
  items: (ItineraryItem | LocalItineraryItem)[];
  beforeSuggestions: OutingSuggestion[];
  afterSuggestions: OutingSuggestion[];
  suggestionsLoading: boolean;
  suggestionsError: string | null;
  saving: boolean;
  creating: boolean;
  addingId: number | null;
  addSuggestion: (suggestion: OutingSuggestion) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  shareUrl: string | null;
  canSuggest: boolean;
  anchorName: string | null;
  anchorHour: number | null;
  anchorCategory: string | null;
  itineraryId: string | null;
  makeShareable: () => Promise<string | null>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOutingPlanner(
  portalId: string,
  portalSlug: string,
  anchor: AnchorInput | null,
  isOpen: boolean,
): UseOutingPlannerReturn {
  const {
    activeItinerary,
    saving,
    createItinerary,
    addItem,
    removeItem: removeItineraryItem,
    getShareUrl,
    makeShareable,
  } = useItinerary(portalId, portalSlug);

  const [phase, setPhase] = useState<OutingPhase>("suggestions");
  const [beforeSuggestions, setBeforeSuggestions] = useState<OutingSuggestion[]>([]);
  const [afterSuggestions, setAfterSuggestions] = useState<OutingSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<number | null>(null);

  // Track whether we've created an itinerary for this anchor
  const itineraryCreatedRef = useRef<string | null>(null);
  // Mutex: prevent concurrent addSuggestion from double-creating itineraries
  const creatingRef = useRef(false);
  const [creating, setCreating] = useState(false);

  // Derive anchor properties
  const anchorCoords = (() => {
    if (!anchor) return null;
    if (anchor.type === "event" && anchor.event.venue?.lat != null && anchor.event.venue?.lng != null) {
      return { lat: anchor.event.venue.lat, lng: anchor.event.venue.lng };
    }
    if (anchor.type === "venue" && anchor.venue.lat != null && anchor.venue.lng != null) {
      return { lat: anchor.venue.lat, lng: anchor.venue.lng };
    }
    return null;
  })();

  const anchorTime = (() => {
    if (!anchor) return null;
    if (anchor.type === "event") return anchor.event.start_time;
    // For venue anchors, default to "tonight" — 7 PM
    return "19:00";
  })();

  const anchorEndTime = (() => {
    if (!anchor) return null;
    if (anchor.type === "event") return anchor.event.end_time;
    return null;
  })();

  const anchorDate = (() => {
    if (!anchor) return null;
    if (anchor.type === "event") return anchor.event.start_date;
    // For venue anchors, use today
    return new Date().toISOString().split("T")[0];
  })();

  const anchorName = (() => {
    if (!anchor) return null;
    if (anchor.type === "event") return anchor.event.venue?.name ?? null;
    return anchor.venue.name;
  })();

  const anchorHour = anchorTime ? parseInt(anchorTime.split(":")[0], 10) : null;

  const anchorCategory = anchor?.type === "event" ? (anchor.event.category_id ?? null) : null;

  const canSuggest = anchorCoords !== null && anchorTime !== null;

  // Fetch suggestions when open + anchor has coords/time
  useEffect(() => {
    if (!isOpen || !canSuggest || !anchorCoords || !anchorTime || !anchorDate) return;

    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    async function fetchSuggestions() {
      setSuggestionsLoading(true);
      setSuggestionsError(null);

      const params = new URLSearchParams({
        anchor_lat: String(anchorCoords!.lat),
        anchor_lng: String(anchorCoords!.lng),
        anchor_time: anchorTime!,
        anchor_date: anchorDate!,
        slot: "both",
      });
      if (anchorEndTime) {
        params.set("anchor_end_time", anchorEndTime);
      }
      if (anchor?.type === "event") {
        params.set("anchor_event_id", String(anchor.event.id));
      }

      try {
        const res = await fetch(
          `/api/portals/${portalSlug}/outing-suggestions?${params}`,
          { signal: controller.signal },
        );

        if (cancelled) return;

        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setBeforeSuggestions(data.before ?? []);
            setAfterSuggestions(data.after ?? []);
          }
        }
      } catch {
        if (cancelled) return;
        if (!cancelled) setSuggestionsError("Couldn't load suggestions");
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) setSuggestionsLoading(false);
      }
    }

    fetchSuggestions();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [isOpen, canSuggest, anchorCoords?.lat, anchorCoords?.lng, anchorTime, anchorEndTime, anchorDate, portalSlug]);

  // Reset phase when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setPhase("suggestions");
      itineraryCreatedRef.current = null;
    }
  }, [isOpen]);

  // Add suggestion → lazy itinerary creation (mutex-protected)
  const addSuggestion = useCallback(
    async (suggestion: OutingSuggestion) => {
      if (!anchor) return;
      // Mutex: wait if another add is already creating the itinerary
      if (creatingRef.current) return;
      setAddingId(suggestion.id);
      setCreating(true);

      try {
        let itinId = itineraryCreatedRef.current || activeItinerary?.id || null;

        // Lazy create: first addition creates the itinerary + adds anchor
        if (!itinId) {
          creatingRef.current = true;
          const title = anchor.type === "event"
            ? `Outing: ${anchor.event.title}`
            : `Outing: ${anchor.venue.name}`;
          const date = anchorDate || undefined;
          itinId = await createItinerary(portalId, title, date);
          if (!itinId) {
            setAddingId(null);
            creatingRef.current = false;
            return;
          }
          itineraryCreatedRef.current = itinId;

          // Add anchor as first item
          if (anchor.type === "event") {
            // Compute duration from start/end when available
            let anchorDuration: number | undefined;
            if (anchor.event.start_time && anchor.event.end_time) {
              const [sh, sm] = anchor.event.start_time.split(":").map(Number);
              const [eh, em] = anchor.event.end_time.split(":").map(Number);
              const diff = ((eh * 60 + em) - (sh * 60 + sm) + 1440) % 1440;
              if (diff > 0 && diff <= 480) anchorDuration = diff; // cap at 8h
            }
            await addItem({
              item_type: "event",
              event_id: anchor.event.id,
              start_time: anchor.event.start_time || undefined,
              duration_minutes: anchorDuration,
              event_title: anchor.event.title,
              custom_lat: anchor.event.venue?.lat ?? undefined,
              custom_lng: anchor.event.venue?.lng ?? undefined,
              venue_name: anchor.event.venue?.name,
            }, itinId);
          } else {
            await addItem({
              item_type: "venue",
              venue_id: anchor.venue.id,
              start_time: anchorTime || undefined,
              venue_name: anchor.venue.name,
              custom_lat: anchor.venue.lat ?? undefined,
              custom_lng: anchor.venue.lng ?? undefined,
            }, itinId);
          }
        }

        // Add the suggestion as a venue item
        const input: AddItineraryItemInput = {
          item_type: suggestion.type === "event" ? "event" : "venue",
          ...(suggestion.type === "event"
            ? { event_id: suggestion.id, event_title: suggestion.title }
            : { venue_id: suggestion.venue.id, venue_name: suggestion.venue.name }),
          custom_lat: suggestion.venue.lat || undefined,
          custom_lng: suggestion.venue.lng || undefined,
          venue_image: suggestion.image_url,
        };

        await addItem(input, itinId);
        setPhase("planning");
      } finally {
        setAddingId(null);
        setCreating(false);
        creatingRef.current = false;
      }
    },
    [anchor, activeItinerary, portalId, anchorDate, anchorTime, createItinerary, addItem],
  );

  const handleRemoveItem = useCallback(
    async (itemId: string) => {
      await removeItineraryItem(itemId);
    },
    [removeItineraryItem],
  );

  // Extract items from active itinerary (memoized to prevent unnecessary re-renders)
  const items = useMemo<(ItineraryItem | LocalItineraryItem)[]>(() => {
    if (!activeItinerary) return [];
    if ("items" in activeItinerary && Array.isArray(activeItinerary.items)) {
      return activeItinerary.items;
    }
    return [];
  }, [activeItinerary]);

  // Auto-switch to planning phase if items exist
  useEffect(() => {
    if (items.length > 0 && phase === "suggestions") {
      setPhase("planning");
    }
  }, [items.length, phase]);

  return {
    phase,
    items,
    beforeSuggestions,
    afterSuggestions,
    suggestionsLoading,
    suggestionsError,
    saving,
    creating,
    addingId,
    addSuggestion,
    removeItem: handleRemoveItem,
    shareUrl: getShareUrl(),
    canSuggest,
    anchorName,
    anchorHour,
    anchorCategory,
    itineraryId: itineraryCreatedRef.current || activeItinerary?.id || null,
    makeShareable,
  };
}
