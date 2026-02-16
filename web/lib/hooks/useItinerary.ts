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

type UseItineraryReturn = {
  itineraries: (Itinerary | LocalItinerary)[];
  activeItinerary: (Itinerary & { items: ItineraryItem[] }) | LocalItinerary | null;
  loading: boolean;
  saving: boolean;
  createItinerary: (portalId: string, title?: string, date?: string) => Promise<string | null>;
  loadItinerary: (id: string) => Promise<void>;
  updateItinerary: (updates: { title?: string; date?: string; is_public?: boolean }) => Promise<void>;
  deleteItinerary: (id: string) => Promise<void>;
  addItem: (input: AddItineraryItemInput) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  reorderItems: (itemIds: string[]) => Promise<void>;
  getShareUrl: () => string | null;
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
          }
        } catch {
          // Fall back to local
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
          }
        } catch {
          // noop
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
            setActiveItinerary(data.itinerary);
          }
        } catch {
          // noop
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
    async (updates: { title?: string; date?: string; is_public?: boolean }) => {
      if (!activeItinerary) return;
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
          }
        } catch {
          // noop
        }
      } else {
        const locals = getLocalItineraries(portalId);
        const idx = locals.findIndex((l) => l.id === activeItinerary.id);
        if (idx >= 0) {
          locals[idx] = { ...locals[idx], ...updates, updated_at: new Date().toISOString() };
          saveLocalItineraries(portalId, locals);
          setActiveItinerary(locals[idx]);
        }
      }
      setSaving(false);
    },
    [user, activeItinerary, portalId]
  );

  const deleteItinerary = useCallback(
    async (id: string) => {
      if (user) {
        await fetch(`/api/itineraries/${id}`, { method: "DELETE" });
      }
      const locals = getLocalItineraries(portalId);
      saveLocalItineraries(
        portalId,
        locals.filter((l) => l.id !== id)
      );
      setItineraries((prev) => (prev as Itinerary[]).filter((i) => i.id !== id));
      if (activeItinerary?.id === id) setActiveItinerary(null);
    },
    [user, activeItinerary, portalId]
  );

  const addItem = useCallback(
    async (input: AddItineraryItemInput) => {
      if (!activeItinerary) return;
      setSaving(true);

      if (user) {
        try {
          const res = await fetch(
            `/api/itineraries/${activeItinerary.id}/items`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(input),
            }
          );
          if (res.ok) {
            // Reload the full itinerary to get joined data
            await loadItinerary(activeItinerary.id);
          }
        } catch {
          // noop
        }
      } else {
        const localItin = activeItinerary as LocalItinerary;
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
    },
    [user, activeItinerary, portalId, loadItinerary]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      if (!activeItinerary) return;
      setSaving(true);

      if (user) {
        await fetch(
          `/api/itineraries/${activeItinerary.id}/items/${itemId}`,
          { method: "DELETE" }
        );
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
    },
    [user, activeItinerary, portalId, loadItinerary]
  );

  const reorderItems = useCallback(
    async (itemIds: string[]) => {
      if (!activeItinerary) return;
      setSaving(true);

      if (user) {
        await fetch(`/api/itineraries/${activeItinerary.id}/items/reorder`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_ids: itemIds }),
        });
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
  };
}
