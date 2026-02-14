"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import EventCard from "./EventCard";
import type { Event } from "@/lib/supabase";
import { getLocalDateString } from "@/lib/formats";
import Skeleton from "@/components/Skeleton";

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
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let isMounted = true;

    async function fetchLiveEvents() {
      const now = new Date();
      const today = getLocalDateString();
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
        .or("is_sensitive.eq.false,is_sensitive.is.null")
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

      try {
        const { data, error } = await query;

        // Don't update state if component unmounted
        if (!isMounted) return;

        if (error) {
          // Ignore abort errors silently (happen during navigation)
          const isAbortError = error.message?.includes("AbortError") ||
                              error.message?.includes("aborted") ||
                              error.name === "AbortError";
          if (!isAbortError) {
            console.error("Error fetching live events:", error.message, error.code, error.details);
          }
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
      } catch (err) {
        // Ignore abort errors (happen during navigation)
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        if (!isMounted) return;
        console.error("Error fetching live events:", err);
        setEvents([]);
        setLoading(false);
      }
    }

    fetchLiveEvents();

    // Refresh every minute
    const interval = setInterval(fetchLiveEvents, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [portalId, isExclusive, supabase]);

  if (loading) {
    return (
      <div className="py-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full skeleton-shimmer" />
          <div className="h-3 w-32 rounded skeleton-shimmer" />
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="p-3 rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)]"
            >
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-12 flex flex-col items-center justify-center">
                  <div className="h-4 w-8 rounded skeleton-shimmer" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3.5 h-3.5 rounded skeleton-shimmer" />
                    <Skeleton className="h-4 rounded w-3/4" delay={`${i * 0.1}s`} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Skeleton className="h-3 rounded w-24" delay={`${i * 0.1 + 0.1}s`} />
                    <Skeleton className="h-3 rounded w-16" delay={`${i * 0.1 + 0.15}s`} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[var(--twilight)] to-[var(--dusk)] flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-[var(--cream)] text-lg font-medium mb-1">Dead air</p>
        <p className="text-sm text-[var(--muted)] mb-6">
          Nothing live at the moment. Patience.
        </p>

        {/* Coming up next hint */}
        <div className="max-w-sm mx-auto p-4 rounded-lg border border-[var(--twilight)]/50 bg-[var(--twilight)]/10 mb-6">
          <div className="flex items-center gap-2 text-[var(--muted)] text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Events typically start in the evening</span>
          </div>
        </div>

        <Link
          href={`/${portalSlug}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--rose)] transition-colors font-mono text-sm font-medium"
        >
          Browse upcoming events
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    );
  }

  return (
    <div className="py-4">
      {/* Header with live indicator and update timestamp - enhanced urgency */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-4 w-4">
            <span className="animate-ping animate-duration-1500 absolute inline-flex h-full w-full rounded-full bg-[var(--neon-red)] opacity-40" />
            <span className="animate-pulse animate-duration-2000 absolute inline-flex h-3 w-3 rounded-full bg-[var(--neon-red)] opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--neon-red)] shadow-[0_0_8px_var(--neon-red)]" />
          </span>
          <p className="font-mono text-base font-bold text-[var(--neon-red)]">
            {events.length} LIVE NOW
          </p>
        </div>
        <span className="font-mono text-[0.6rem] text-[var(--muted)] opacity-60">
          Auto-updates every minute
        </span>
      </div>

      {/* Events list */}
      <div className="space-y-2">
        {events.map((event, index) => (
          <EventCard key={event.id} event={event} index={index} portalSlug={portalSlug} />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t border-[var(--twilight)]">
        <Link
          href={`/${portalSlug}`}
          className="inline-flex items-center gap-2 font-mono text-sm text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
        >
          View all upcoming events
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
