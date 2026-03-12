"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import type {
  Itinerary,
  ItineraryItem,
  LocalItinerary,
  LocalItineraryItem,
  AddItineraryItemInput,
} from "@/lib/itinerary-utils";
import {
  getLocalItineraries,
  saveLocalItineraries,
  generateClientId,
  haversineDistanceMeters,
  estimateWalkMinutes,
  getItemCoords,
} from "@/lib/itinerary-utils";

type OutingEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time?: string | null;
};

type UseItineraryReturn = {
  itineraries: (Itinerary | LocalItinerary)[];
  activeItinerary: (Itinerary & { items: ItineraryItem[] }) | LocalItinerary | null;
  loading: boolean;
  saving: boolean;
  createItinerary: (portalId: string, title?: string, date?: string) => Promise<string | null>;
  loadItinerary: (id: string) => Promise<void>;
  updateItinerary: (updates: { title?: string; date?: string; is_public?: boolean }) => Promise<boolean>;
  deleteItinerary: (id: string) => Promise<boolean>;
  addItem: (input: AddItineraryItemInput, itineraryId?: string) => Promise<boolean>;
  removeItem: (itemId: string) => Promise<boolean>;
  reorderItems: (itemIds: string[]) => Promise<boolean>;
  getShareUrl: () => string | null;
  makeShareable: () => Promise<string | null>;
  createOutingFromEvent: (portalId: string, event: OutingEvent) => Promise<string | null>;
};

export function useItinerary(portalId: string, portalSlug: string): UseItineraryReturn {
  const { user } = useAuth();
  const [itineraries, setItineraries] = useState<(Itinerary | LocalItinerary)[]>([]);
  const [activeItinerary, setActiveItinerary] = useState<
    (Itinerary & { items: ItineraryItem[] }) | LocalItinerary | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load itineraries list
  useEffect(() => {
    async function load() {
      setLoading(true);
      if (user) {
        try {
          const res = await fetch(`/api/itineraries?portal_id=${portalId}`);
          if (res.ok) {
            const data = await res.json();
            setItineraries(data.itineraries || []);
          } else {
            console.error("Failed to load itineraries:", res.status);
            setItineraries(getLocalItineraries(portalId));
          }
        } catch (err) {
          console.error("Failed to load itineraries:", err);
          setItineraries(getLocalItineraries(portalId));
        }
      } else {
        setItineraries(getLocalItineraries(portalId));
      }
      setLoading(false);
    }
    load();
  }, [user, portalId]);

  const createItinerary = useCallback(
    async (pid: string, title?: string, date?: string): Promise<string | null> => {
      setSaving(true);
      if (user) {
        try {
          const res = await fetch("/api/itineraries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ portal_id: pid, title, date }),
          });
          if (res.ok) {
            const data = await res.json();
            const itin = data.itinerary as Itinerary;
            setItineraries((prev) => [itin, ...prev]);
            setActiveItinerary({ ...itin, items: [] });
            setSaving(false);
            return itin.id;
          } else {
            console.error("Failed to create itinerary:", res.status);
          }
        } catch (err) {
          console.error("Failed to create itinerary:", err);
        }
        setSaving(false);
        return null;
      } else {
        const id = generateClientId();
        const localItin: LocalItinerary = {
          id,
          portal_id: pid,
          title: title || "My Itinerary",
          date: date || null,
          description: null,
          items: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const updated = [localItin, ...getLocalItineraries(pid)];
        saveLocalItineraries(pid, updated);
        setItineraries(updated);
        setActiveItinerary(localItin);
        setSaving(false);
        return id;
      }
    },
    [user]
  );

  const loadItinerary = useCallback(
    async (id: string) => {
      setLoading(true);
      if (user) {
        try {
          const res = await fetch(`/api/itineraries/${id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.itinerary && typeof data.itinerary.id === "string") {
              setActiveItinerary(data.itinerary);
            } else {
              console.error("Invalid itinerary response shape:", data);
            }
          } else {
            console.error("Failed to load itinerary:", res.status);
          }
        } catch (err) {
          console.error("Failed to load itinerary:", err);
        }
      } else {
        const locals = getLocalItineraries(portalId);
        const found = locals.find((l) => l.id === id);
        if (found) setActiveItinerary(found);
      }
      setLoading(false);
    },
    [user, portalId]
  );

  const updateItinerary = useCallback(
    async (updates: { title?: string; date?: string; is_public?: boolean; visibility?: string }): Promise<boolean> => {
      if (!activeItinerary) return false;
      setSaving(true);

      if (user) {
        try {
          const res = await fetch(`/api/itineraries/${activeItinerary.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          });
          if (res.ok) {
            const data = await res.json();
            setActiveItinerary((prev) =>
              prev ? { ...prev, ...data.itinerary } : prev
            );
            setSaving(false);
            return true;
          } else {
            console.error("Failed to update itinerary:", res.status);
            setSaving(false);
            return false;
          }
        } catch (err) {
          console.error("Failed to update itinerary:", err);
          setSaving(false);
          return false;
        }
      } else {
        const locals = getLocalItineraries(portalId);
        const idx = locals.findIndex((l) => l.id === activeItinerary.id);
        if (idx >= 0) {
          locals[idx] = { ...locals[idx], ...updates, updated_at: new Date().toISOString() };
          saveLocalItineraries(portalId, locals);
          setActiveItinerary(locals[idx]);
        }
        setSaving(false);
        return true;
      }
    },
    [user, activeItinerary, portalId]
  );

  const deleteItinerary = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        if (user) {
          const res = await fetch(`/api/itineraries/${id}`, { method: "DELETE" });
          if (!res.ok) {
            console.error("Failed to delete itinerary:", res.status);
            return false;
          }
        }
        const locals = getLocalItineraries(portalId);
        saveLocalItineraries(
          portalId,
          locals.filter((l) => l.id !== id)
        );
        setItineraries((prev) => (prev as Itinerary[]).filter((i) => i.id !== id));
        if (activeItinerary?.id === id) setActiveItinerary(null);
        return true;
      } catch (err) {
        console.error("Failed to delete itinerary:", err);
        return false;
      }
    },
    [user, activeItinerary, portalId]
  );

  const addItem = useCallback(
    async (input: AddItineraryItemInput, itineraryId?: string): Promise<boolean> => {
      // Support explicit itineraryId to avoid stale closure when called
      // immediately after createItinerary (state hasn't re-rendered yet)
      const targetId = itineraryId || activeItinerary?.id;
      if (!targetId) return false;
      setSaving(true);

      if (user) {
        try {
          const res = await fetch(
            `/api/itineraries/${targetId}/items`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(input),
            }
          );
          if (res.ok) {
            // Reload the full itinerary to get joined data
            await loadItinerary(targetId);
          } else {
            console.error("Failed to add item:", res.status);
            setSaving(false);
            return false;
          }
        } catch (err) {
          console.error("Failed to add item:", err);
          setSaving(false);
          return false;
        }
      } else {
        // For localStorage: find itinerary from state or storage
        const localItin = (activeItinerary?.id === targetId
          ? activeItinerary
          : getLocalItineraries(portalId).find((l) => l.id === targetId)
        ) as LocalItinerary | null;
        if (!localItin) { setSaving(false); return false; }

        const items = localItin.items || [];
        const prevItem = items[items.length - 1];

        let walkDistance: number | null = null;
        let walkTime: number | null = null;

        if (prevItem) {
          const prevCoords = getItemCoords(prevItem);
          const newLat = input.custom_lat || null;
          const newLng = input.custom_lng || null;
          if (prevCoords && newLat != null && newLng != null) {
            walkDistance = Math.round(
              haversineDistanceMeters(prevCoords.lat, prevCoords.lng, newLat, newLng)
            );
            walkTime = estimateWalkMinutes(walkDistance);
          }
        }

        const newItem: LocalItineraryItem = {
          id: generateClientId(),
          item_type: input.item_type,
          event_id: input.event_id || null,
          venue_id: input.venue_id || null,
          custom_title: input.custom_title || null,
          custom_description: input.custom_description || null,
          custom_address: input.custom_address || null,
          custom_lat: input.custom_lat || null,
          custom_lng: input.custom_lng || null,
          position: items.length,
          start_time: input.start_time || null,
          duration_minutes: input.duration_minutes || 60,
          walk_distance_meters: walkDistance,
          walk_time_minutes: walkTime,
          notes: input.notes || null,
          // Cached display data so anonymous items render correctly
          venue_name: input.venue_name,
          venue_image: input.venue_image ?? null,
          event_title: input.event_title,
          event_image: input.event_image ?? null,
        };

        const updatedItems = [...items, newItem];
        const updatedItin: LocalItinerary = {
          ...localItin,
          items: updatedItems,
          updated_at: new Date().toISOString(),
        };

        setActiveItinerary(updatedItin);
        const locals = getLocalItineraries(portalId);
        const idx = locals.findIndex((l) => l.id === localItin.id);
        if (idx >= 0) {
          locals[idx] = updatedItin;
        } else {
          locals.unshift(updatedItin);
        }
        saveLocalItineraries(portalId, locals);
      }
      setSaving(false);
      return true;
    },
    [user, activeItinerary, portalId, loadItinerary]
  );

  const removeItem = useCallback(
    async (itemId: string): Promise<boolean> => {
      if (!activeItinerary) return false;
      setSaving(true);

      try {
        if (user) {
          const res = await fetch(
            `/api/itineraries/${activeItinerary.id}/items/${itemId}`,
            { method: "DELETE" }
          );
          if (!res.ok) {
            console.error("Failed to remove item:", res.status);
            setSaving(false);
            return false;
          }
          await loadItinerary(activeItinerary.id);
        } else {
          const localItin = activeItinerary as LocalItinerary;
          const updatedItems = localItin.items
            .filter((i) => i.id !== itemId)
            .map((item, idx) => ({ ...item, position: idx }));
          const updatedItin: LocalItinerary = {
            ...localItin,
            items: updatedItems,
            updated_at: new Date().toISOString(),
          };
          setActiveItinerary(updatedItin);
          const locals = getLocalItineraries(portalId);
          const idx = locals.findIndex((l) => l.id === localItin.id);
          if (idx >= 0) {
            locals[idx] = updatedItin;
            saveLocalItineraries(portalId, locals);
          }
        }
        setSaving(false);
        return true;
      } catch (err) {
        console.error("Failed to remove item:", err);
        setSaving(false);
        return false;
      }
    },
    [user, activeItinerary, portalId, loadItinerary]
  );

  const reorderItems = useCallback(
    async (itemIds: string[]): Promise<boolean> => {
      if (!activeItinerary) return false;
      setSaving(true);

      try {
        if (user) {
          const res = await fetch(`/api/itineraries/${activeItinerary.id}/items/reorder`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ item_ids: itemIds }),
          });
          if (!res.ok) {
            console.error("Failed to reorder items:", res.status);
            setSaving(false);
            return false;
          }
          await loadItinerary(activeItinerary.id);
        } else {
          const localItin = activeItinerary as LocalItinerary;
          const itemMap = new Map(localItin.items.map((i) => [i.id, i]));
          const reordered = itemIds
            .map((id) => itemMap.get(id))
            .filter(Boolean) as LocalItineraryItem[];
          const updatedItin: LocalItinerary = {
            ...localItin,
            items: reordered.map((item, idx) => ({ ...item, position: idx })),
            updated_at: new Date().toISOString(),
          };
          setActiveItinerary(updatedItin);
          const locals = getLocalItineraries(portalId);
          const idx = locals.findIndex((l) => l.id === localItin.id);
          if (idx >= 0) {
            locals[idx] = updatedItin;
            saveLocalItineraries(portalId, locals);
          }
        }
        setSaving(false);
        return true;
      } catch (err) {
        console.error("Failed to reorder items:", err);
        setSaving(false);
        return false;
      }
    },
    [user, activeItinerary, portalId, loadItinerary]
  );

  const getShareUrl = useCallback((): string | null => {
    if (!activeItinerary) return null;
    const token = (activeItinerary as Itinerary).share_token;
    if (!token) return null;
    if (typeof window === "undefined") return null;
    return `${window.location.origin}/${portalSlug}/itinerary/${token}`;
  }, [activeItinerary, portalSlug]);

  /**
   * Make the itinerary shareable — upgrades visibility and returns the share URL.
   * Call this when the user explicitly shares (not on every render).
   */
  const makeShareable = useCallback(async (): Promise<string | null> => {
    if (!activeItinerary || !user) return null;
    const itin = activeItinerary as Itinerary;

    // Only upgrade if currently private
    if (!itin.visibility || itin.visibility === "private") {
      const ok = await updateItinerary({ visibility: "invitees" });
      if (!ok) return null;
    }

    return getShareUrl();
  }, [activeItinerary, user, updateItinerary, getShareUrl]);

  const createOutingFromEvent = useCallback(
    async (pid: string, event: OutingEvent): Promise<string | null> => {
      const itinId = await createItinerary(pid, event.title, event.start_date);
      if (!itinId) return null;
      await addItem({
        item_type: "event",
        event_id: event.id,
        start_time: event.start_time || undefined,
      }, itinId);
      return itinId;
    },
    [createItinerary, addItem],
  );

  return {
    itineraries,
    activeItinerary,
    loading,
    saving,
    createItinerary,
    loadItinerary,
    updateItinerary,
    deleteItinerary,
    addItem,
    removeItem,
    reorderItems,
    getShareUrl,
    makeShareable,
    createOutingFromEvent,
  };
}
