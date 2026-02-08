"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { FestivalSession } from "@/lib/festivals";

interface FestivalMapProps {
  sessions: FestivalSession[];
  portalSlug: string;
}

interface VenuePin {
  id: number;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  neighborhood: string | null;
  eventCount: number;
}

export default function FestivalMap({ sessions, portalSlug }: FestivalMapProps) {
  // Collect unique venues with coordinates
  const venues = useMemo(() => {
    const venueMap = new Map<number, VenuePin>();

    for (const session of sessions) {
      if (!session.venue) continue;

      const existing = venueMap.get(session.venue.id);
      if (existing) {
        existing.eventCount += 1;
      } else {
        // We don't have lat/lng in FestivalSession, so we can't render the map
        // This component will be a placeholder until we extend the query
        venueMap.set(session.venue.id, {
          id: session.venue.id,
          name: session.venue.name,
          slug: session.venue.slug,
          lat: 0,
          lng: 0,
          neighborhood: session.venue.neighborhood,
          eventCount: 1,
        });
      }
    }

    return Array.from(venueMap.values());
  }, [sessions]);

  // Skip for single-venue or no-venue festivals
  if (venues.length < 2) return null;

  // Group venues by neighborhood, sorted by total event count per group
  const grouped = useMemo(() => {
    const groups = new Map<string, VenuePin[]>();
    for (const venue of venues) {
      const hood = venue.neighborhood || "Other";
      const arr = groups.get(hood) ?? [];
      arr.push(venue);
      groups.set(hood, arr);
    }
    // Sort groups by total event count (descending)
    return Array.from(groups.entries())
      .map(([neighborhood, venueList]) => ({
        neighborhood,
        venues: venueList.sort((a, b) => b.eventCount - a.eventCount),
        totalEvents: venueList.reduce((sum, v) => sum + v.eventCount, 0),
      }))
      .sort((a, b) => b.totalEvents - a.totalEvents);
  }, [venues]);

  return (
    <section>
      <h2 className="text-lg font-semibold text-[var(--cream)] mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Venues
        <span className="text-sm font-normal text-[var(--muted)]">
          ({venues.length})
        </span>
      </h2>

      <div className="space-y-5">
        {grouped.map((group) => (
          <div key={group.neighborhood}>
            <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] mb-2">
              {group.neighborhood}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {group.venues.map((venue) => (
                <Link
                  key={venue.id}
                  href={`/${portalSlug}/spots/${venue.slug}`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)] hover:border-[var(--soft)] transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-[var(--twilight)] flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-[var(--cream)] truncate">{venue.name}</h4>
                    <p className="text-xs text-[var(--muted)]">
                      {venue.eventCount} session{venue.eventCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-[var(--muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
