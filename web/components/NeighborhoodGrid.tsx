"use client";

import { memo, useMemo } from "react";
import NeighborhoodCard from "./NeighborhoodCard";

interface NeighborhoodStats {
  name: string;
  liveCount: number;
  openCount: number;
}

interface NeighborhoodGridProps {
  neighborhoods: string[];
  events: Array<{ venue?: { neighborhood?: string | null } | null }>;
  spots: Array<{ neighborhood?: string | null }>;
  selectedNeighborhood: string | null;
  onSelectNeighborhood: (neighborhood: string | null) => void;
}

function NeighborhoodGrid({
  neighborhoods,
  events,
  spots,
  selectedNeighborhood,
  onSelectNeighborhood,
}: NeighborhoodGridProps) {
  // Calculate stats per neighborhood
  const neighborhoodStats = useMemo(() => {
    const stats: Record<string, NeighborhoodStats> = {};

    // Initialize all neighborhoods
    neighborhoods.forEach((name) => {
      stats[name] = { name, liveCount: 0, openCount: 0 };
    });

    // Count live events per neighborhood
    events.forEach((event) => {
      const hood = event.venue?.neighborhood;
      if (hood && stats[hood]) {
        stats[hood].liveCount++;
      }
    });

    // Count open spots per neighborhood
    spots.forEach((spot) => {
      const hood = spot.neighborhood;
      if (hood && stats[hood]) {
        stats[hood].openCount++;
      }
    });

    // Sort by activity (most active first)
    return Object.values(stats).sort((a, b) => {
      const totalA = a.liveCount + a.openCount;
      const totalB = b.liveCount + b.openCount;
      return totalB - totalA;
    });
  }, [neighborhoods, events, spots]);

  // Show only neighborhoods with activity, plus a few quiet ones
  const visibleNeighborhoods = useMemo(() => {
    const active = neighborhoodStats.filter((n) => n.liveCount > 0 || n.openCount > 0);
    const quiet = neighborhoodStats.filter((n) => n.liveCount === 0 && n.openCount === 0).slice(0, 4);
    return [...active, ...quiet].slice(0, 12);
  }, [neighborhoodStats]);

  if (visibleNeighborhoods.length === 0) {
    return null;
  }

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
          Neighborhoods
        </h3>
        {selectedNeighborhood && (
          <button
            onClick={() => onSelectNeighborhood(null)}
            className="font-mono text-[0.6rem] text-[var(--neon-amber)] hover:text-[var(--cream)] transition-colors"
          >
            Clear filter
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {visibleNeighborhoods.map((hood) => (
          <NeighborhoodCard
            key={hood.name}
            name={hood.name}
            liveCount={hood.liveCount}
            openCount={hood.openCount}
            isSelected={selectedNeighborhood === hood.name}
            onClick={() =>
              onSelectNeighborhood(selectedNeighborhood === hood.name ? null : hood.name)
            }
          />
        ))}
      </div>
    </div>
  );
}

export default memo(NeighborhoodGrid);
