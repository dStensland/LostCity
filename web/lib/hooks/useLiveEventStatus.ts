"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";


type UseLiveEventStatusOptions = {
  eventIds?: number[];
  enabled?: boolean;
};

/**
 * Hook to subscribe to real-time updates for event live status.
 * Returns a Map of eventId -> isLive status that updates in real-time.
 */
export function useLiveEventStatus({ eventIds = [], enabled = true }: UseLiveEventStatusOptions = {}) {
  const [liveStatus, setLiveStatus] = useState<Map<number, boolean>>(new Map());
  const supabase = createClient();

  const handleUpdate = useCallback((payload: { new: { id: number; is_live: boolean } }) => {
    const { id, is_live } = payload.new;
    setLiveStatus((prev) => {
      const next = new Map(prev);
      next.set(id, is_live);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!enabled || eventIds.length === 0) return;

    let channel: RealtimeChannel | null = null;

    async function subscribe() {
      // Build filter for specific event IDs
      const filter = eventIds.length <= 10
        ? `id=in.(${eventIds.join(",")})`
        : undefined; // Too many IDs, subscribe to all updates

      channel = supabase
        .channel("live-events")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "events",
            filter,
          },
          handleUpdate
        )
        .subscribe();
    }

    subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase, eventIds, enabled, handleUpdate]);

  return {
    liveStatus,
    isLive: (eventId: number) => liveStatus.get(eventId),
  };
}

/**
 * Hook to subscribe to a single event's live status.
 */
export function useSingleEventLiveStatus(eventId: number, initialIsLive: boolean = false) {
  const [isLive, setIsLive] = useState(initialIsLive);
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`event-${eventId}-live`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "events",
          filter: `id=eq.${eventId}`,
        },
        (payload) => {
          const newData = payload.new as { is_live?: boolean };
          if (typeof newData.is_live === "boolean") {
            setIsLive(newData.is_live);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, eventId]);

  return isLive;
}
