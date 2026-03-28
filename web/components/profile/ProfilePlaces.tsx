"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Venue = {
  id: number;
  name: string;
  slug: string;
  neighborhood?: string;
  image_url?: string;
};

export default function ProfileVenues({ username }: { username: string }) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVenues() {
      try {
        const res = await fetch(`/api/profile/${username}?section=venues`);
        if (res.ok) {
          const data = await res.json();
          setVenues(data.venues || []);
        }
      } catch (err) {
        console.error("Failed to fetch venues:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchVenues();
  }, [username]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse h-24 rounded-lg bg-[var(--twilight)]" />
        ))}
      </div>
    );
  }

  if (venues.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p className="font-mono text-sm text-[var(--muted)]">No followed venues</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {venues.map((venue) => (
        <Link
          key={venue.id}
          href={`/spots/${venue.slug}`}
          className="p-4 rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)] hover:border-[var(--coral)]/50 transition-colors"
        >
          <h3 className="text-sm font-medium text-[var(--cream)] truncate">{venue.name}</h3>
          {venue.neighborhood && (
            <p className="font-mono text-xs text-[var(--muted)] mt-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              {venue.neighborhood}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}
