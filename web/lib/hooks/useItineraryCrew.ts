"use client";

import { useState, useCallback } from "react";
import { useAuthenticatedFetch } from "./useAuthenticatedFetch";
import type {
  ItineraryCrew,
  RsvpStatus,
  StopStatus,
} from "@/lib/itinerary-utils";

type StopUpdate = {
  item_id: string;
  status: StopStatus;
  arrival_time?: string;
  note?: string;
};

type InviteInput =
  | { user_id: string; contact?: never }
  | { contact: string; user_id?: never };

/**
 * Hook for managing itinerary crew (participants + per-stop availability).
 *
 * Usage:
 * ```
 * const { crew, loading, fetchCrew, invite, updateRsvp, updateStops } = useItineraryCrew(itineraryId);
 * ```
 */
export function useItineraryCrew(itineraryId: string | null) {
  const { authFetch } = useAuthenticatedFetch();
  const [crew, setCrew] = useState<ItineraryCrew | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);

  const fetchCrew = useCallback(async () => {
    if (!itineraryId) return;
    setLoading(true);
    const { data } = await authFetch<ItineraryCrew>(
      `/api/itineraries/${itineraryId}/participants`,
      { showErrorToast: false }
    );
    if (data) setCrew(data);
    setLoading(false);
  }, [itineraryId, authFetch]);

  const invite = useCallback(
    async (input: InviteInput): Promise<boolean> => {
      if (!itineraryId) return false;
      setInviting(true);
      const { error } = await authFetch(
        `/api/itineraries/${itineraryId}/participants`,
        { method: "POST", body: input }
      );
      setInviting(false);
      if (!error) {
        // Refetch crew to get updated list
        await fetchCrew();
        return true;
      }
      return false;
    },
    [itineraryId, authFetch, fetchCrew]
  );

  const updateRsvp = useCallback(
    async (
      participantId: string,
      rsvpStatus: RsvpStatus,
      stops?: StopUpdate[]
    ): Promise<boolean> => {
      if (!itineraryId) return false;
      const body: Record<string, unknown> = { rsvp_status: rsvpStatus };
      if (stops) body.stops = stops;

      const { error } = await authFetch(
        `/api/itineraries/${itineraryId}/participants/${participantId}/stops`,
        { method: "PATCH", body }
      );
      if (!error) {
        // Optimistic update for RSVP status
        setCrew((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            going:
              prev.going +
              (rsvpStatus === "going" ? 1 : 0) -
              (prev.participants.find((p) => p.id === participantId)
                ?.rsvp_status === "going"
                ? 1
                : 0),
            pending:
              prev.pending +
              (rsvpStatus === "pending" ? 1 : 0) -
              (prev.participants.find((p) => p.id === participantId)
                ?.rsvp_status === "pending"
                ? 1
                : 0),
            cant_go:
              prev.cant_go +
              (rsvpStatus === "cant_go" ? 1 : 0) -
              (prev.participants.find((p) => p.id === participantId)
                ?.rsvp_status === "cant_go"
                ? 1
                : 0),
            participants: prev.participants.map((p) =>
              p.id === participantId
                ? {
                    ...p,
                    rsvp_status: rsvpStatus,
                    responded_at: new Date().toISOString(),
                    stops: stops
                      ? stops.map((s) => ({
                          item_id: s.item_id,
                          status: s.status,
                          arrival_time: s.arrival_time ?? null,
                          note: s.note ?? null,
                        }))
                      : p.stops,
                  }
                : p
            ),
          };
        });
        return true;
      }
      return false;
    },
    [itineraryId, authFetch]
  );

  const updateStops = useCallback(
    async (
      participantId: string,
      stops: StopUpdate[]
    ): Promise<boolean> => {
      if (!itineraryId) return false;
      const { error } = await authFetch(
        `/api/itineraries/${itineraryId}/participants/${participantId}/stops`,
        { method: "PATCH", body: { stops } }
      );
      if (!error) {
        // Optimistic update for stops
        setCrew((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            participants: prev.participants.map((p) => {
              if (p.id !== participantId) return p;
              const updatedStops = [...p.stops];
              for (const stop of stops) {
                const idx = updatedStops.findIndex(
                  (s) => s.item_id === stop.item_id
                );
                const newStop = {
                  item_id: stop.item_id,
                  status: stop.status,
                  arrival_time: stop.arrival_time ?? null,
                  note: stop.note ?? null,
                };
                if (idx >= 0) {
                  updatedStops[idx] = newStop;
                } else {
                  updatedStops.push(newStop);
                }
              }
              return { ...p, stops: updatedStops };
            }),
          };
        });
        return true;
      }
      return false;
    },
    [itineraryId, authFetch]
  );

  return {
    crew,
    loading,
    inviting,
    fetchCrew,
    invite,
    updateRsvp,
    updateStops,
  };
}
