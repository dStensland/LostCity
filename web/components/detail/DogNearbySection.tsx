"use client";

import { useState, useEffect } from "react";
import { classifyDogContentType, DOG_CONTENT_COLORS } from "@/lib/dog-art";
import { SectionHeader } from "@/components/detail/SectionHeader";
import { CaretRight } from "@phosphor-icons/react";

type DogNearbySpot = {
  id: number;
  name: string;
  slug: string;
  venue_type: string | null;
  vibes: string[] | null;
  short_description: string | null;
};

interface DogNearbySectionProps {
  neighborhood: string;
  currentVenueId: number;
  onSpotClick: (slug: string) => void;
}

export default function DogNearbySection({
  neighborhood,
  currentVenueId,
  onSpotClick,
}: DogNearbySectionProps) {
  const [spots, setSpots] = useState<DogNearbySpot[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    async function fetchNearby() {
      try {
        const params = new URLSearchParams({
          neighborhood,
          vibes: "dog-friendly",
        });
        const res = await fetch(`/api/spots?${params}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) return;
        const data = await res.json();
        const filtered = (data.spots || [])
          .filter((s: { id: number }) => s.id !== currentVenueId)
          .slice(0, 6);
        setSpots(filtered);
      } catch {
        if (controller.signal.aborted) return;
      } finally {
        setLoaded(true);
      }
    }
    fetchNearby();
    return () => controller.abort();
  }, [neighborhood, currentVenueId]);

  if (!loaded || spots.length === 0) return null;

  return (
    <div className="mt-8">
      <SectionHeader title="Dog-Friendly Nearby" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {spots.map((s) => {
          const contentType = classifyDogContentType(s.venue_type, s.vibes, null, false);
          const color = DOG_CONTENT_COLORS[contentType];
          return (
            <button
              key={s.id}
              onClick={() => onSpotClick(s.slug)}
              className="flex items-start gap-3 p-3 rounded-xl border transition-colors text-left group min-h-[44px] bg-[var(--dusk)] border-[var(--twilight)] focus-ring"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
                style={{ background: `${color}20` }}
              >
                {contentType === "parks" && "🌳"}
                {contentType === "food" && "🍽️"}
                {contentType === "services" && "🦴"}
                {contentType === "trails" && "🥾"}
                {contentType === "adoption" && "❤️"}
                {contentType === "events" && "🐾"}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate transition-colors text-[var(--cream)]">
                  {s.name}
                </h3>
                {s.short_description && (
                  <p className="text-xs mt-0.5 line-clamp-1 text-[var(--muted)]">
                    {s.short_description}
                  </p>
                )}
                {s.vibes && s.vibes.some((v) => v === "off-leash" || v === "pup-cup") && (
                  <div className="flex gap-1.5 mt-1">
                    {s.vibes.includes("off-leash") && (
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ background: `${DOG_CONTENT_COLORS.parks}20`, color: DOG_CONTENT_COLORS.parks }}>
                        Off-Leash
                      </span>
                    )}
                    {s.vibes.includes("pup-cup") && (
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ background: `${DOG_CONTENT_COLORS.food}20`, color: DOG_CONTENT_COLORS.food }}>
                        Pup Cup
                      </span>
                    )}
                  </div>
                )}
              </div>
              <CaretRight size={16} weight="bold" aria-hidden="true" className="flex-shrink-0 mt-1 transition-colors text-[var(--muted)]" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
