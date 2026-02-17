"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";

type UpcomingEvent = {
  id: number;
  title: string;
  start_date: string;
  venue_name?: string;
  category?: string;
};

export default function ProfileUpcoming({ username }: { username: string }) {
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUpcoming() {
      try {
        const res = await fetch(`/api/profile/${username}?section=upcoming`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
        }
      } catch (err) {
        console.error("Failed to fetch upcoming events:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchUpcoming();
  }, [username]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-20 rounded-lg bg-[var(--twilight)]" />
        <div className="h-20 rounded-lg bg-[var(--twilight)]" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="font-mono text-sm text-[var(--muted)]">No upcoming events</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <Link
          key={event.id}
          href={`/events/${event.id}`}
          className="block p-4 rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)] hover:border-[var(--coral)]/50 transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-[var(--cream)]">{event.title}</h3>
              {event.venue_name && (
                <p className="font-mono text-xs text-[var(--muted)] mt-1">{event.venue_name}</p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-mono text-xs text-[var(--coral)]">
                {format(new Date(event.start_date), "MMM d")}
              </p>
              <p className="font-mono text-xs text-[var(--muted)]">
                {format(new Date(event.start_date), "h:mm a")}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
