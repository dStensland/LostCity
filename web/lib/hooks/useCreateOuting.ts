"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import type {
  AddItineraryItemInput,
  LocalItinerary,
  LocalItineraryItem,
} from "@/lib/itinerary-utils";
import {
  getLocalItineraries,
  saveLocalItineraries,
  generateClientId,
} from "@/lib/itinerary-utils";

type OutingEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time?: string | null;
};

/**
 * Lightweight hook that only provides createOutingFromEvent.
 * Use this instead of useItinerary when you don't need the full itinerary list —
 * useItinerary fetches /api/itineraries on mount, which is wasteful on pages like
 * EventDetailView that only need the create action.
 */
export function useCreateOuting(_portalId: string, _portalSlug: string) {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);

  const createOutingFromEvent = useCallback(
    async (pid: string, event: OutingEvent): Promise<string | null> => {
      setCreating(true);
      try {
        if (user) {
          // Create the itinerary
          const createRes = await fetch("/api/itineraries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              portal_id: pid,
              title: event.title,
              date: event.start_date,
            }),
          });
          if (!createRes.ok) {
            console.error("Failed to create itinerary:", createRes.status);
            return null;
          }
          const createData = await createRes.json();
          const itinId: string | undefined = createData.itinerary?.id;
          if (!itinId) return null;

          // Add the event as the first item
          const itemRes = await fetch(`/api/itineraries/${itinId}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              item_type: "event",
              event_id: event.id,
              start_time: event.start_time || undefined,
            } satisfies AddItineraryItemInput),
          });
          if (!itemRes.ok) {
            console.error("Failed to add event to itinerary:", itemRes.status);
          }
          return itinId;
        } else {
          // Anonymous path — persist to localStorage
          const itinId = generateClientId();
          const itemId = generateClientId();
          const localItem: LocalItineraryItem = {
            id: itemId,
            item_type: "event",
            event_id: event.id,
            venue_id: null,
            custom_title: null,
            custom_description: null,
            custom_address: null,
            custom_lat: null,
            custom_lng: null,
            position: 0,
            start_time: event.start_time ?? null,
            duration_minutes: 60,
            walk_distance_meters: null,
            walk_time_minutes: null,
            notes: null,
          };
          const localItin: LocalItinerary = {
            id: itinId,
            portal_id: pid,
            title: event.title,
            date: event.start_date,
            description: null,
            items: [localItem],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          const existing = getLocalItineraries(pid);
          saveLocalItineraries(pid, [localItin, ...existing]);
          return itinId;
        }
      } catch (err) {
        console.error("Failed to create outing:", err);
        return null;
      } finally {
        setCreating(false);
      }
    },
    [user]
  );

  return { createOutingFromEvent, creating };
}
