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

export default function SpotFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedType = searchParams.get("type") || "all";
  const selectedHood = searchParams.get("hood") || "all";

  const navigate = useCallback((type: string, hood: string) => {
    const params = new URLSearchParams();
    if (type && type !== "all") params.set("type", type);
    if (hood && hood !== "all") params.set("hood", hood);
    const query = params.toString();
    router.push(`/spots${query ? `?${query}` : ""}`);
  }, [router]);

  const hasFilters = selectedType !== "all" || selectedHood !== "all";

  return (
    <div className="sticky top-0 z-30 bg-[var(--night)]">
      {/* Type Filter Row */}
      <div className="border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
            <button
              onClick={() => navigate("all", selectedHood)}
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
                onClick={() => navigate(type, selectedHood)}
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
              onClick={() => navigate(selectedType, "all")}
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
                onClick={() => navigate(selectedType, hood)}
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
                  onClick={() => navigate("all", selectedHood)}
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
                  onClick={() => navigate(selectedType, "all")}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--twilight)] text-[var(--cream)] font-mono text-[0.65rem] hover:bg-[var(--dusk)] transition-colors"
                >
                  {selectedHood}
                  <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => navigate("all", "all")}
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
