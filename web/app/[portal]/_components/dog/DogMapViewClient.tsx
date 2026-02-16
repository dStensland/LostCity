"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import type { Spot } from "@/lib/spots-constants";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const FILTER_OPTIONS = [
  { key: "all", label: "All" },
  { key: "parks", label: "Parks" },
  { key: "patios", label: "Patios" },
  { key: "services", label: "Services" },
  { key: "trails", label: "Trails" },
] as const;

const PARK_TYPES = new Set(["park", "dog_park", "trail", "nature_preserve"]);
const PATIO_TYPES = new Set(["brewery", "restaurant", "bar", "coffee_shop", "cafe"]);
const SERVICE_TYPES = new Set(["vet", "groomer", "pet_store", "pet_daycare", "animal_shelter"]);
const TRAIL_TYPES = new Set(["trail", "nature_preserve"]);

function matchesFilter(venueType: string | null, filter: string): boolean {
  if (filter === "all" || !venueType) return filter === "all";
  switch (filter) {
    case "parks":
      return PARK_TYPES.has(venueType);
    case "patios":
      return PATIO_TYPES.has(venueType);
    case "services":
      return SERVICE_TYPES.has(venueType);
    case "trails":
      return TRAIL_TYPES.has(venueType);
    default:
      return true;
  }
}

interface Props {
  spots: Spot[];
}

export default function DogMapViewClient({ spots }: Props) {
  const [activeFilter, setActiveFilter] = useState("all");

  const filteredSpots = useMemo(() => {
    if (activeFilter === "all") return spots;
    return spots.filter((s) => matchesFilter(s.venue_type, activeFilter));
  }, [spots, activeFilter]);

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 56px - 64px)" }}>
      {/* Filter chips */}
      <div
        className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide"
        style={{ background: "var(--dog-cream, #FFFBEB)" }}
      >
        {FILTER_OPTIONS.map((opt) => {
          const active = activeFilter === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => setActiveFilter(opt.key)}
              className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors"
              style={{
                background: active
                  ? "var(--dog-orange, #FF6B35)"
                  : "rgba(253, 232, 138, 0.25)",
                color: active ? "#fff" : "var(--dog-charcoal, #292524)",
              }}
            >
              {opt.label}
              {active && activeFilter !== "all" && (
                <span className="ml-1.5 opacity-80">
                  {filteredSpots.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0">
        <MapView
          events={[]}
          spots={filteredSpots}
          fitAllMarkers
          showMobileSheet
        />
      </div>
    </div>
  );
}
