"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { EventWithLocation } from "@/lib/search";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[var(--night)] rounded-lg flex items-center justify-center border border-[var(--twilight)]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--neon-cyan)] mx-auto mb-2"></div>
        <p className="text-[var(--muted)] font-mono text-sm">Loading map...</p>
      </div>
    </div>
  ),
});

interface Props {
  events?: EventWithLocation[];
  userLocation?: { lat: number; lng: number } | null;
  portalId?: string;
  portalExclusive?: boolean;
}

export default function MapViewWrapper({ events: initialEvents, userLocation, portalId, portalExclusive }: Props) {
  const [events, setEvents] = useState<EventWithLocation[]>(initialEvents || []);
  const [loading, setLoading] = useState(!initialEvents);
  const searchParams = useSearchParams();

  // Fetch events client-side if not provided
  useEffect(() => {
    // Skip if we have initial events
    if (initialEvents && initialEvents.length > 0) {
      return;
    }

    const controller = new AbortController();

    async function fetchMapEvents() {
      setLoading(true);

      const params = new URLSearchParams(searchParams.toString());
      params.delete("view");
      params.set("for_map", "true");

      if (portalId && portalId !== "default") {
        params.set("portal_id", portalId);
      }
      if (portalExclusive) {
        params.set("portal_exclusive", "true");
      }

      try {
        const res = await fetch(`/api/events?${params}`, {
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        setEvents(data.events || []);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Failed to fetch map events:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchMapEvents();

    return () => controller.abort();
  }, [searchParams, portalId, portalExclusive, initialEvents]);

  // Refetch when filters change
  useEffect(() => {
    // Skip initial mount or if we have server data
    if (initialEvents) return;

    const controller = new AbortController();

    async function refetch() {
      setLoading(true);

      const params = new URLSearchParams(searchParams.toString());
      params.delete("view");
      params.set("for_map", "true");

      if (portalId && portalId !== "default") {
        params.set("portal_id", portalId);
      }
      if (portalExclusive) {
        params.set("portal_exclusive", "true");
      }

      try {
        const res = await fetch(`/api/events?${params}`, {
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        setEvents(data.events || []);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Failed to fetch map events:", error);
      } finally {
        setLoading(false);
      }
    }

    refetch();

    return () => controller.abort();
  }, [searchParams, portalId, portalExclusive, initialEvents]);

  if (loading && events.length === 0) {
    return (
      <div className="w-full h-full bg-[var(--night)] rounded-lg flex items-center justify-center border border-[var(--twilight)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--neon-cyan)] mx-auto mb-2"></div>
          <p className="text-[var(--muted)] font-mono text-sm">Loading events...</p>
        </div>
      </div>
    );
  }

  return <MapView events={events} userLocation={userLocation} />;
}
