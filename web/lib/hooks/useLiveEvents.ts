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
 * Hook to subscribe to live events with real-time updates.
 * Accepts optional portalSlug to filter events by portal (prevents cross-portal leakage).
 * Automatically refetches when events go live or end.
 */
export function useLiveEvents(portalSlug?: string): UseLiveEventsResult {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const fetchLiveEvents = useCallback(async (signal?: AbortSignal) => {
    try {
      const params = portalSlug ? `?portal=${portalSlug}` : "";
      const response = await fetch(`/api/events/live${params}`, { signal });
      if (!response.ok) throw new Error("Failed to fetch live events");

      const data = await response.json();
      if (mountedRef.current) {
        setEvents(data.events);
        setError(null);
      }
    } catch (err) {
      // Ignore abort errors - they're expected during cleanup
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [portalSlug]);

  useEffect(() => {
    mountedRef.current = true;
    const supabase = createClient();

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
          filter: "is_live=eq.true",
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
      mountedRef.current = false;
      // Abort any in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchLiveEvents]); // Only depends on fetchLiveEvents which is stable

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
  const channelRef = useRef<RealtimeChannel | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const supabase = createClient();

    async function fetchCount() {
      const { count: liveCount } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("is_live", true);

      if (mountedRef.current) {
        setCount(liveCount || 0);
      }
    }

    fetchCount();

    // Subscribe to changes
    channelRef.current = supabase
      .channel("live-event-count")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "events",
          filter: "is_live=eq.true",
        },
        () => {
          fetchCount();
        }
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []); // Empty deps - supabase client is a singleton

  return count;
}
