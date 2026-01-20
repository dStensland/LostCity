"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Event } from "@/lib/supabase";

type LiveEvent = Event & {
  going_count?: number;
};

type UseLiveEventsResult = {
  events: LiveEvent[];
  loading: boolean;
  error: Error | null;
  count: number;
  refetch: () => Promise<void>;
};

/**
 * Hook to subscribe to all live events with real-time updates.
 * Automatically refetches when events go live or end.
 */
export function useLiveEvents(): UseLiveEventsResult {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchLiveEvents = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/events/live", { signal });
      if (!response.ok) throw new Error("Failed to fetch live events");

      const data = await response.json();
      setEvents(data.events);
      setError(null);
    } catch (err) {
      // Ignore abort errors - they're expected during cleanup
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Create abort controller for cleanup
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // Initial fetch
    fetchLiveEvents(signal);

    // Subscribe to real-time updates for is_live changes
    channelRef.current = supabase
      .channel("all-live-events")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "events",
        },
        (payload) => {
          const newData = payload.new as { id: number; is_live?: boolean; title?: string };
          if (typeof newData.is_live === "boolean") {
            // Update single event in state instead of refetching entire list
            setEvents((prev) => {
              if (newData.is_live) {
                // Event went live - add if not present, update if exists
                const exists = prev.some((e) => e.id === newData.id);
                if (exists) {
                  return prev.map((e) =>
                    e.id === newData.id ? { ...e, is_live: true } : e
                  );
                }
                // New live event - need to fetch its full data
                fetchLiveEvents();
                return prev;
              } else {
                // Event ended - remove from list
                return prev.filter((e) => e.id !== newData.id);
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      // Abort any in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [supabase, fetchLiveEvents]);

  return {
    events,
    loading,
    error,
    count: events.length,
    refetch: fetchLiveEvents,
  };
}

/**
 * Hook to get count of live events (for nav indicator).
 * Lighter weight than full events hook.
 */
export function useLiveEventCount(): number {
  const [count, setCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    async function fetchCount() {
      const { count: liveCount } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("is_live", true);

      setCount(liveCount || 0);
    }

    fetchCount();

    // Subscribe to changes
    const channel = supabase
      .channel("live-event-count")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "events",
        },
        () => {
          fetchCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return count;
}
