"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import CategoryIcon, { CATEGORY_CONFIG, getCategoryLabel } from "./CategoryIcon";
import { VIBE_GROUPS, VIBES } from "@/lib/spots";
import { PREFERENCE_NEIGHBORHOODS } from "@/lib/preferences";

const SPOT_TYPES = [
  { value: "music_venue", label: "Music Venue" },
  { value: "theater", label: "Theater" },
  { value: "comedy_club", label: "Comedy Club" },
  { value: "bar", label: "Bar" },
  { value: "restaurant", label: "Restaurant" },
  { value: "coffee_shop", label: "Coffee Shop" },
  { value: "brewery", label: "Brewery" },
  { value: "gallery", label: "Gallery" },
  { value: "museum", label: "Museum" },
  { value: "club", label: "Club" },
  { value: "arena", label: "Arena" },
] as const;

type GroupBy = "none" | "category" | "neighborhood";

interface Props {
  onGroupByChange?: (groupBy: GroupBy) => void;
  currentGroupBy?: GroupBy;
}

export default function SpotFilterBar({ onGroupByChange, currentGroupBy = "none" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selectedTypes = useMemo(
    () => searchParams.get("type")?.split(",").filter(Boolean) || [],
    [searchParams]
  );
  const selectedNeighborhoods = useMemo(
    () => searchParams.get("hood")?.split(",").filter(Boolean) || [],
    [searchParams]
  );
  const selectedVibes = useMemo(
    () => searchParams.get("vibe")?.split(",").filter(Boolean) || [],
    [searchParams]
  );

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const query = params.toString();
      router.push(`/spots${query ? `?${query}` : ""}`, { scroll: false });
    },
    [router, searchParams]
  );

  const toggleType = useCallback(
    (type: string) => {
      const newTypes = selectedTypes.includes(type)
        ? selectedTypes.filter((t) => t !== type)
        : [...selectedTypes, type];
      updateParams({ type: newTypes.length > 0 ? newTypes.join(",") : null });
    },
    [selectedTypes, updateParams]
  );

  const toggleNeighborhood = useCallback(
    (hood: string) => {
      const newHoods = selectedNeighborhoods.includes(hood)
        ? selectedNeighborhoods.filter((h) => h !== hood)
        : [...selectedNeighborhoods, hood];
      updateParams({ hood: newHoods.length > 0 ? newHoods.join(",") : null });
    },
    [selectedNeighborhoods, updateParams]
  );

  const toggleVibe = useCallback(
    (vibe: string) => {
      const newVibes = selectedVibes.includes(vibe)
        ? selectedVibes.filter((v) => v !== vibe)
        : [...selectedVibes, vibe];
      updateParams({ vibe: newVibes.length > 0 ? newVibes.join(",") : null });
    },
    [selectedVibes, updateParams]
  );

  const clearAll = useCallback(() => {
    updateParams({ type: null, hood: null, vibe: null });
  }, [updateParams]);

  const hasFilters = selectedTypes.length > 0 || selectedNeighborhoods.length > 0 || selectedVibes.length > 0;
  const filterCount = selectedTypes.length + selectedNeighborhoods.length + selectedVibes.length;

  return (
    <>
      {/* Filter bar */}
      <div className="sticky top-[104px] z-30 bg-[var(--night)] border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4 py-2">
          <div className="flex items-center gap-2">
            {/* Filters button */}
            <button
              onClick={() => setDrawerOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-medium transition-all ${
                hasFilters
                  ? "bg-[var(--coral)] text-[var(--void)]"
                  : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
              {filterCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-[var(--void)]/20 text-[0.6rem]">
                  {filterCount}
                </span>
              )}
            </button>

            {/* Group by toggle */}
            <div className="flex items-center gap-1 bg-[var(--twilight)]/50 rounded-full p-0.5">
              <button
                onClick={() => onGroupByChange?.("none")}
                className={`px-2.5 py-1 rounded-full font-mono text-[0.65rem] font-medium transition-colors ${
                  currentGroupBy === "none"
                    ? "bg-[var(--cream)] text-[var(--void)]"
                    : "text-[var(--muted)] hover:text-[var(--cream)]"
                }`}
              >
                List
              </button>
              <button
                onClick={() => onGroupByChange?.("category")}
                className={`px-2.5 py-1 rounded-full font-mono text-[0.65rem] font-medium transition-colors ${
                  currentGroupBy === "category"
                    ? "bg-[var(--cream)] text-[var(--void)]"
                    : "text-[var(--muted)] hover:text-[var(--cream)]"
                }`}
              >
                By Type
              </button>
              <button
                onClick={() => onGroupByChange?.("neighborhood")}
                className={`px-2.5 py-1 rounded-full font-mono text-[0.65rem] font-medium transition-colors ${
                  currentGroupBy === "neighborhood"
                    ? "bg-[var(--cream)] text-[var(--void)]"
                    : "text-[var(--muted)] hover:text-[var(--cream)]"
                }`}
              >
                By Hood
              </button>
            </div>

            {/* Active filter chips */}
            {hasFilters && !drawerOpen && (
              <div className="flex items-center gap-1.5 overflow-x-auto flex-1 scrollbar-hide">
                {selectedTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--twilight)] text-[0.65rem] font-mono font-medium text-[var(--cream)] whitespace-nowrap"
                  >
                    <CategoryIcon type={type} size={10} />
                    {getCategoryLabel(type)}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ))}
                {selectedNeighborhoods.map((hood) => (
                  <button
                    key={hood}
                    onClick={() => toggleNeighborhood(hood)}
                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--gold)] text-[0.65rem] font-mono font-medium text-[var(--void)] whitespace-nowrap"
                  >
                    {hood}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ))}
                {selectedVibes.map((vibe) => (
                  <button
                    key={vibe}
                    onClick={() => toggleVibe(vibe)}
                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--rose)] text-[0.65rem] font-mono font-medium text-[var(--void)] whitespace-nowrap"
                  >
                    {VIBES.find((v) => v.value === vibe)?.label || vibe}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ))}
                <button
                  onClick={clearAll}
                  className="px-2 py-1 font-mono text-[0.65rem] text-[var(--coral)] hover:text-[var(--rose)] whitespace-nowrap"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setDrawerOpen(false)} />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-[var(--night)] border-r border-[var(--twilight)] transform transition-transform duration-200 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--twilight)]">
            <span className="font-mono text-sm font-medium text-[var(--cream)]">Filters</span>
            <button
              onClick={() => setDrawerOpen(false)}
              className="p-1 text-[var(--muted)] hover:text-[var(--cream)]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Spot Types */}
            <div>
              <div className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider mb-2">Type</div>
              <div className="flex flex-wrap gap-1.5">
                {SPOT_TYPES.map((type) => {
                  const isActive = selectedTypes.includes(type.value);
                  return (
                    <button
                      key={type.value}
                      onClick={() => toggleType(type.value)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-all ${
                        isActive
                          ? "bg-[var(--cream)] text-[var(--void)]"
                          : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                      }`}
                    >
                      <CategoryIcon
                        type={type.value}
                        size={12}
                        style={{ color: isActive ? "var(--void)" : CATEGORY_CONFIG[type.value as keyof typeof CATEGORY_CONFIG]?.color }}
                      />
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Neighborhoods */}
            <div>
              <div className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider mb-2">Neighborhood</div>
              <div className="flex flex-wrap gap-1.5">
                {PREFERENCE_NEIGHBORHOODS.map((hood) => (
                  <button
                    key={hood}
                    onClick={() => toggleNeighborhood(hood)}
                    className={`px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-colors ${
                      selectedNeighborhoods.includes(hood)
                        ? "bg-[var(--gold)] text-[var(--void)]"
                        : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                    }`}
                  >
                    {hood}
                  </button>
                ))}
              </div>
            </div>

            {/* Vibes */}
            <div>
              <div className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider mb-2">Vibe</div>
              {Object.entries(VIBE_GROUPS).map(([group, vibes]) => (
                <div key={group} className="mb-3">
                  <div className="font-mono text-[0.55rem] text-[var(--muted)] mb-1.5">{group}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {vibes.map((vibe) => (
                      <button
                        key={vibe.value}
                        onClick={() => toggleVibe(vibe.value)}
                        className={`px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-colors ${
                          selectedVibes.includes(vibe.value)
                            ? "bg-[var(--rose)] text-[var(--void)]"
                            : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                        }`}
                      >
                        {vibe.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          {hasFilters && (
            <div className="px-4 py-3 border-t border-[var(--twilight)] flex gap-2">
              <button
                onClick={clearAll}
                className="flex-1 px-3 py-2 rounded-lg font-mono text-xs font-medium text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)]"
              >
                Clear all
              </button>
              <button
                onClick={() => setDrawerOpen(false)}
                className="flex-1 px-3 py-2 rounded-lg font-mono text-xs font-medium bg-[var(--coral)] text-[var(--void)]"
              >
                Show results
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
