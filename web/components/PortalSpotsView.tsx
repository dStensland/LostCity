"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import CategoryIcon, { getCategoryLabel } from "./CategoryIcon";

type Spot = {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  neighborhood: string | null;
  spot_type: string | null;
  event_count?: number;
};

interface Props {
  portalId: string;
  portalSlug: string;
  isExclusive?: boolean;
}

export default function PortalSpotsView({ portalId, portalSlug, isExclusive = false }: Props) {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSpots() {
      try {
        const params = new URLSearchParams();
        if (portalId) params.set("portal_id", portalId);
        if (isExclusive) params.set("exclusive", "true");

        const res = await fetch(`/api/spots?${params}`);
        const data = await res.json();

        setSpots(data.spots || []);
      } catch (error) {
        console.error("Failed to fetch spots:", error);
        setSpots([]);
      } finally {
        setLoading(false);
      }
    }

    fetchSpots();
  }, [portalId, isExclusive]);

  if (loading) {
    return (
      <div className="py-4">
        <div className="mb-4">
          <div className="h-3 w-40 rounded skeleton-shimmer" />
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-lg border border-[var(--twilight)]"
              style={{ backgroundColor: "var(--card-bg)" }}
            >
              <div className="flex items-start gap-3">
                <div className="w-[18px] h-[18px] rounded skeleton-shimmer" />
                <div className="flex-1 min-w-0">
                  <div className="h-4 w-2/3 rounded skeleton-shimmer mb-2" style={{ animationDelay: `${i * 0.05}s` }} />
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-20 rounded skeleton-shimmer" style={{ animationDelay: `${i * 0.05 + 0.1}s` }} />
                    <div className="h-3 w-24 rounded skeleton-shimmer" style={{ animationDelay: `${i * 0.05 + 0.15}s` }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (spots.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[var(--twilight)] to-[var(--dusk)] flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p className="text-[var(--cream)] text-lg font-medium mb-1">No locations found</p>
        <p className="text-[var(--muted)] text-sm mb-4">
          We haven&apos;t discovered any venues for this portal yet
        </p>
        <Link
          href={`/${portalSlug}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--twilight)]/50 text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors font-mono text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          View all events
        </Link>
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="mb-4">
        <p className="font-mono text-xs text-[var(--muted)]">
          <span className="text-[var(--soft)]">{spots.length}</span> locations with upcoming events
        </p>
      </div>

      <div className="space-y-2">
        {spots.map((spot) => (
          <Link
            key={spot.id}
            href={`/spots/${spot.slug}`}
            className="block p-4 rounded-lg border border-[var(--twilight)] card-event-hover group"
            style={{ backgroundColor: "var(--card-bg)", "--glow-color": "var(--coral)" } as React.CSSProperties}
          >
            <div className="flex items-start gap-3">
              {spot.spot_type && (
                <CategoryIcon
                  type={spot.spot_type}
                  size={18}
                  className="flex-shrink-0 opacity-60 mt-0.5"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors">
                  {spot.name}
                </div>
                <div className="flex items-center gap-2 font-mono text-xs text-[var(--muted)] mt-1">
                  {spot.spot_type && (
                    <span>{getCategoryLabel(spot.spot_type)}</span>
                  )}
                  {spot.neighborhood && (
                    <>
                      <span className="opacity-40">·</span>
                      <span>{spot.neighborhood}</span>
                    </>
                  )}
                  {(spot.event_count ?? 0) > 0 && (
                    <>
                      <span className="opacity-40">·</span>
                      <span className="text-[var(--coral)]">
                        {spot.event_count} upcoming event{spot.event_count !== 1 ? "s" : ""}
                      </span>
                    </>
                  )}
                </div>
                {spot.address && (
                  <div className="font-mono text-[0.65rem] text-[var(--muted)] mt-1 opacity-60">
                    {spot.address}
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
