"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import EventCard from "./EventCard";
import type { Event } from "@/lib/supabase";

type EventWithVenue = Event & {
  venue?: {
    id: number;
    name: string;
    slug: string;
    address: string | null;
    neighborhood: string | null;
  } | null;
  is_live?: boolean;
};

interface Props {
  portalId: string;
  portalSlug: string;
  isExclusive?: boolean;
}

export default function PortalHappeningNow({ portalId, portalSlug, isExclusive = false }: Props) {
  const [events, setEvents] = useState<EventWithVenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLiveEvents() {
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM

      // Build query for events happening now
      let query = supabase
        .from("events")
        .select(`
          *,
          venue:venues(id, name, slug, address, neighborhood)
        `)
        .eq("start_date", today)
        .lte("start_time", currentTime)
        .order("start_time", { ascending: true });

      // Filter by portal
      if (isExclusive) {
        query = query.eq("portal_id", portalId);
      } else if (portalId === "default") {
        // Default portal - show all public events
        query = query.is("portal_id", null);
      } else {
        query = query.or(`portal_id.eq.${portalId},portal_id.is.null`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching live events:", error);
        setEvents([]);
        setLoading(false);
        return;
      }

      // Filter to only events that are currently happening
      // (started but haven't ended yet)
      const liveEvents = (data || []).filter((event: EventWithVenue) => {
        if (!event.start_time) return false;

        // If there's an end_time, check if we're past it
        if (event.end_time && event.end_time < currentTime) {
          return false;
        }

        // If no end_time, assume events last ~3 hours
        const startParts = event.start_time.split(":");
        const startHour = parseInt(startParts[0], 10);
        const startMin = parseInt(startParts[1], 10);
        const endHour = startHour + 3;

        const nowParts = currentTime.split(":");
        const nowHour = parseInt(nowParts[0], 10);

        // Check if current time is within ~3 hours of start
        if (nowHour > endHour + 1) {
          return false;
        }

        return true;
      }).map((event: EventWithVenue) => ({
        ...event,
        is_live: true,
      }));

      setEvents(liveEvents);
      setLoading(false);
    }

    fetchLiveEvents();

    // Refresh every minute
    const interval = setInterval(fetchLiveEvents, 60000);
    return () => clearInterval(interval);
  }, [portalId, isExclusive]);

  if (loading) {
    return (
      <div className="py-16 text-center text-[var(--muted)]">
        Checking for live events...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="mb-4">
          <span className="inline-block w-3 h-3 rounded-full bg-[var(--muted)] opacity-50" />
        </div>
        <p className="text-[var(--muted)] mb-2">No events happening right now</p>
        <p className="text-sm text-[var(--muted)] opacity-60 mb-4">
          Check back later or browse upcoming events
        </p>
        <Link
          href={`/${portalSlug}`}
          className="inline-block font-mono text-sm text-[var(--coral)] hover:text-[var(--rose)]"
        >
          View all events
        </Link>
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-[var(--neon-red)] animate-pulse" />
        <p className="font-mono text-xs text-[var(--neon-red)]">
          {events.length} event{events.length !== 1 ? "s" : ""} happening now
        </p>
      </div>

      <div className="space-y-2">
        {events.map((event, index) => (
          <EventCard key={event.id} event={event} index={index} />
        ))}
      </div>

      <div className="mt-8 pt-4 border-t border-[var(--twilight)]">
        <Link
          href={`/${portalSlug}`}
          className="font-mono text-sm text-[var(--muted)] hover:text-[var(--cream)]"
        >
          View all upcoming events
        </Link>
      </div>
    </div>
  );
}
