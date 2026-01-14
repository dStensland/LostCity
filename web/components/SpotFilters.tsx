"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import CategoryIcon, { CATEGORY_CONFIG, getCategoryLabel } from "./CategoryIcon";

const SPOT_TYPES = [
  "music_venue",
  "theater",
  "comedy_club",
  "bar",
  "restaurant",
  "coffee_shop",
  "brewery",
  "gallery",
  "museum",
  "convention_center",
  "games",
  "club",
  "arena",
] as const;

const NEIGHBORHOODS = [
  "Midtown",
  "Downtown",
  "Buckhead",
  "East Atlanta",
  "Inman Park",
  "Virginia-Highland",
  "Decatur",
  "Little Five Points",
  "Old Fourth Ward",
  "West End",
  "Westside",
] as const;

const VIBES = [
  { value: "late-night", label: "Late Night" },
  { value: "date-spot", label: "Date Spot" },
  { value: "outdoor-seating", label: "Outdoor" },
  { value: "divey", label: "Divey" },
  { value: "craft-cocktails", label: "Cocktails" },
  { value: "live-music", label: "Live Music" },
  { value: "dog-friendly", label: "Dog Friendly" },
  { value: "good-for-groups", label: "Groups" },
] as const;

export default function SpotFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedType = searchParams.get("type") || "all";
  const selectedHood = searchParams.get("hood") || "all";
  const selectedVibe = searchParams.get("vibe") || "";
  const selectedVibes = selectedVibe.split(",").filter(Boolean);

  const navigate = useCallback((type: string, hood: string, vibe: string) => {
    const params = new URLSearchParams();
    if (type && type !== "all") params.set("type", type);
    if (hood && hood !== "all") params.set("hood", hood);
    if (vibe) params.set("vibe", vibe);
    const query = params.toString();
    router.push(`/spots${query ? `?${query}` : ""}`);
  }, [router]);

  const toggleVibe = (vibeValue: string) => {
    const newVibes = selectedVibes.includes(vibeValue)
      ? selectedVibes.filter(v => v !== vibeValue)
      : [...selectedVibes, vibeValue];
    navigate(selectedType, selectedHood, newVibes.join(","));
  };

  const hasFilters = selectedType !== "all" || selectedHood !== "all" || selectedVibes.length > 0;

  return (
    <div className="sticky top-0 z-30 bg-[var(--night)]">
      {/* Type Filter Row */}
      <div className="border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
            <button
              onClick={() => navigate("all", selectedHood, selectedVibe)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-medium whitespace-nowrap transition-colors ${
                selectedType === "all"
                  ? "bg-[var(--cream)] text-[var(--void)]"
                  : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              All Types
            </button>
            {SPOT_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => navigate(type, selectedHood, selectedVibe)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedType === type
                    ? "bg-[var(--cream)] text-[var(--void)]"
                    : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                }`}
              >
                <CategoryIcon
                  type={type}
                  size={14}
                  style={{ color: selectedType === type ? "var(--void)" : CATEGORY_CONFIG[type]?.color }}
                />
                {getCategoryLabel(type)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Neighborhood Filter Row */}
      <div className="border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4 py-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 items-center">
            <span className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider flex-shrink-0 mr-1">
              Hood
            </span>
            <button
              onClick={() => navigate(selectedType, "all", selectedVibe)}
              className={`px-2.5 py-1 rounded-full font-mono text-[0.65rem] font-medium whitespace-nowrap transition-colors ${
                selectedHood === "all"
                  ? "bg-[var(--coral)] text-[var(--void)]"
                  : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)]"
              }`}
            >
              All
            </button>
            {NEIGHBORHOODS.map((hood) => (
              <button
                key={hood}
                onClick={() => navigate(selectedType, hood, selectedVibe)}
                className={`px-2.5 py-1 rounded-full font-mono text-[0.65rem] font-medium whitespace-nowrap transition-colors ${
                  selectedHood === hood
                    ? "bg-[var(--coral)] text-[var(--void)]"
                    : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)]"
                }`}
              >
                {hood}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Vibe Filter Row */}
      <div className="border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4 py-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 items-center">
            <span className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider flex-shrink-0 mr-1">
              Vibe
            </span>
            {VIBES.map((vibe) => {
              const isActive = selectedVibes.includes(vibe.value);
              return (
                <button
                  key={vibe.value}
                  onClick={() => toggleVibe(vibe.value)}
                  className={`px-2.5 py-1 rounded-full font-mono text-[0.65rem] font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-[var(--rose)] text-[var(--void)]"
                      : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)]"
                  }`}
                >
                  {vibe.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Filters Summary */}
      {hasFilters && (
        <div className="border-b border-[var(--twilight)] bg-[var(--void)]">
          <div className="max-w-3xl mx-auto px-4 py-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider">
                Filtering:
              </span>
              {selectedType !== "all" && (
                <button
                  onClick={() => navigate("all", selectedHood, selectedVibe)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--twilight)] text-[var(--cream)] font-mono text-[0.65rem] hover:bg-[var(--dusk)] transition-colors"
                >
                  <CategoryIcon type={selectedType} size={12} />
                  {getCategoryLabel(selectedType)}
                  <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {selectedHood !== "all" && (
                <button
                  onClick={() => navigate(selectedType, "all", selectedVibe)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--twilight)] text-[var(--cream)] font-mono text-[0.65rem] hover:bg-[var(--dusk)] transition-colors"
                >
                  {selectedHood}
                  <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {selectedVibes.map((vibe) => (
                <button
                  key={vibe}
                  onClick={() => toggleVibe(vibe)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--twilight)] text-[var(--cream)] font-mono text-[0.65rem] hover:bg-[var(--dusk)] transition-colors"
                >
                  {VIBES.find(v => v.value === vibe)?.label || vibe}
                  <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ))}
              <button
                onClick={() => navigate("all", "all", "")}
                className="font-mono text-[0.6rem] text-[var(--coral)] hover:text-[var(--rose)] transition-colors ml-auto"
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
