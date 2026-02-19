"use client";

import type { FeedEvent } from "@/lib/forth-types";
import type { AddItineraryItemInput, LocalItinerary, LocalItineraryItem } from "@/lib/itinerary-utils";
import { generateClientId, getLocalItineraries, saveLocalItineraries } from "@/lib/itinerary-utils";

type ItinerarySummary = {
  id: string;
  updated_at?: string | null;
};

type QuickAddStorage = "remote" | "local";
type QuickAddItemMode = "event" | "custom";

export type QuickAddEventResult = {
  storage: QuickAddStorage;
  itineraryId: string;
  itineraryCreated: boolean;
  itemMode: QuickAddItemMode;
};

export const ITINERARY_UPDATED_EVENT = "lostcity:itinerary-updated";
export const OPEN_PLANNER_EVENT = "lostcity:open-planner";

type ItineraryUpdatedDetail = {
  portalId: string;
  itineraryId: string;
  source: "quick_add";
};

function dispatchItineraryUpdated(detail: ItineraryUpdatedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ItineraryUpdatedDetail>(ITINERARY_UPDATED_EVENT, { detail }));
}

function todayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function toItineraryStartTime(timeValue: string | null | undefined): string | undefined {
  if (!timeValue) return undefined;
  const match = timeValue.match(/^(\d{2}):(\d{2})/);
  if (!match) return undefined;
  return `${match[1]}:${match[2]}`;
}

function parseEventId(eventId: string | number | undefined): number | null {
  if (typeof eventId === "number" && Number.isInteger(eventId) && eventId > 0) return eventId;
  if (typeof eventId !== "string") return null;
  const trimmed = eventId.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function buildCustomPayload(event: FeedEvent): AddItineraryItemInput {
  return {
    item_type: "custom",
    custom_title: event.title,
    custom_description: event.description || undefined,
    custom_address: event.venue_name || undefined,
    start_time: toItineraryStartTime(event.start_time),
    duration_minutes: 90,
  };
}

export function buildQuickAddPayload(event: FeedEvent): AddItineraryItemInput {
  const parsedEventId = parseEventId(event.id);
  if (parsedEventId === null) return buildCustomPayload(event);

  return {
    item_type: "event",
    event_id: parsedEventId,
    start_time: toItineraryStartTime(event.start_time),
    duration_minutes: 90,
  };
}

async function createRemoteItinerary(portalId: string, date: string | undefined): Promise<string> {
  const response = await fetch("/api/itineraries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      portal_id: portalId,
      title: "My Itinerary",
      date: date || todayDate(),
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to create itinerary");
  }

  const body = await response.json() as { itinerary?: { id?: string } };
  const itineraryId = body.itinerary?.id;
  if (!itineraryId) {
    throw new Error("Missing itinerary ID");
  }
  return itineraryId;
}

async function chooseRemoteItinerary(portalId: string, dateHint: string | undefined): Promise<{ itineraryId: string; created: boolean } | null> {
  const response = await fetch(`/api/itineraries?portal_id=${encodeURIComponent(portalId)}`, {
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to load itineraries");
  }

  const body = await response.json() as { itineraries?: ItinerarySummary[] };
  const itineraries = Array.isArray(body.itineraries) ? body.itineraries : [];

  if (itineraries.length > 0) {
    const [latest] = itineraries.sort((a, b) => {
      const aTs = Date.parse(a.updated_at || "");
      const bTs = Date.parse(b.updated_at || "");
      return (Number.isFinite(bTs) ? bTs : 0) - (Number.isFinite(aTs) ? aTs : 0);
    });
    if (latest?.id) {
      return { itineraryId: latest.id, created: false };
    }
  }

  const createdId = await createRemoteItinerary(portalId, dateHint);
  return { itineraryId: createdId, created: true };
}

async function addRemoteItem(
  itineraryId: string,
  payload: AddItineraryItemInput,
): Promise<{ ok: true } | { ok: false; status: number }> {
  const response = await fetch(`/api/itineraries/${itineraryId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (response.ok) return { ok: true };
  return { ok: false, status: response.status };
}

function addLocalItem(portalId: string, event: FeedEvent): { itineraryId: string; created: boolean; itemMode: QuickAddItemMode } {
  const localItineraries = getLocalItineraries(portalId);
  const itinerary = localItineraries[0];
  const itineraryId = itinerary?.id || generateClientId();
  const itineraryCreated = !itinerary;

  const nextItinerary: LocalItinerary = itinerary || {
    id: itineraryId,
    portal_id: portalId,
    title: "My Itinerary",
    date: event.start_date || todayDate(),
    description: null,
    items: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const parsedEventId = parseEventId(event.id);
  const itemMode: QuickAddItemMode = parsedEventId === null ? "custom" : "event";
  const nextPosition = nextItinerary.items.length;

  const localItem: LocalItineraryItem = {
    id: generateClientId(),
    item_type: itemMode,
    event_id: parsedEventId,
    venue_id: null,
    custom_title: itemMode === "custom" ? event.title : null,
    custom_description: itemMode === "custom" ? event.description || null : null,
    custom_address: itemMode === "custom" ? event.venue_name || null : null,
    custom_lat: null,
    custom_lng: null,
    position: nextPosition,
    start_time: toItineraryStartTime(event.start_time) || null,
    duration_minutes: 90,
    walk_distance_meters: null,
    walk_time_minutes: null,
    notes: null,
    event_title: event.title,
    event_image: event.image_url || null,
    venue_name: event.venue_name || undefined,
    venue_image: null,
  };

  const updatedItinerary: LocalItinerary = {
    ...nextItinerary,
    items: [...nextItinerary.items, localItem],
    updated_at: new Date().toISOString(),
  };

  const rest = localItineraries.filter((item) => item.id !== updatedItinerary.id);
  saveLocalItineraries(portalId, [updatedItinerary, ...rest]);
  return { itineraryId, created: itineraryCreated, itemMode };
}

export async function quickAddEventToItinerary(
  portalId: string,
  event: FeedEvent,
): Promise<QuickAddEventResult> {
  const payload = buildQuickAddPayload(event);

  try {
    const selected = await chooseRemoteItinerary(portalId, event.start_date);
    if (selected) {
      const firstAttempt = await addRemoteItem(selected.itineraryId, payload);
      let itemMode: QuickAddItemMode = payload.item_type === "event" ? "event" : "custom";

      if (!firstAttempt.ok && payload.item_type === "event" && firstAttempt.status === 400) {
        const fallbackPayload = buildCustomPayload(event);
        const fallbackAttempt = await addRemoteItem(selected.itineraryId, fallbackPayload);
        if (!fallbackAttempt.ok) {
          throw new Error("Failed to add remote itinerary item");
        }
        itemMode = "custom";
      } else if (!firstAttempt.ok) {
        throw new Error("Failed to add remote itinerary item");
      }

      dispatchItineraryUpdated({
        portalId,
        itineraryId: selected.itineraryId,
        source: "quick_add",
      });

      return {
        storage: "remote",
        itineraryId: selected.itineraryId,
        itineraryCreated: selected.created,
        itemMode,
      };
    }
  } catch {
    // Fall through to local fallback.
  }

  const local = addLocalItem(portalId, event);
  dispatchItineraryUpdated({
    portalId,
    itineraryId: local.itineraryId,
    source: "quick_add",
  });

  return {
    storage: "local",
    itineraryId: local.itineraryId,
    itineraryCreated: local.created,
    itemMode: local.itemMode,
  };
}
