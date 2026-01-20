"use client";

import { useEffect, useState } from "react";
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
      <div className="py-16 text-center text-[var(--muted)]">
        Loading locations...
      </div>
    );
  }

  if (spots.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-[var(--muted)]">No locations found</p>
        <Link
          href={`/${portalSlug}`}
          className="inline-block mt-4 font-mono text-sm text-[var(--coral)] hover:text-[var(--rose)]"
        >
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
            className="block p-4 rounded-lg border border-[var(--twilight)] transition-colors group"
            style={{ backgroundColor: "var(--card-bg)" }}
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
