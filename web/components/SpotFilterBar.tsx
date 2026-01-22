"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CategoryIcon, { CATEGORY_CONFIG, type CategoryType } from "./CategoryIcon";
import { SPOT_TYPES, NEIGHBORHOODS, VIBE_GROUPS } from "@/lib/spots";
import type { SortOption } from "@/app/spots/page";

type ViewMode = "list" | "type" | "neighborhood";

interface Props {
  viewMode: ViewMode;
  sortBy: SortOption;
  onViewModeChange: (mode: ViewMode) => void;
  onSortChange: (sort: SortOption) => void;
}

// Collapsible section component
function FilterSection({
  title,
  activeFilters,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  activeFilters: string[];
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-[var(--twilight)] last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--twilight)]/20 transition-colors active:scale-[0.99]"
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium text-[var(--cream)] uppercase tracking-wider">
            {title}
          </span>
          {activeFilters.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-[var(--coral)] text-[var(--void)] font-mono text-[0.55rem] font-bold">
              {activeFilters.length}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-[var(--muted)] transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function SpotFilterBar({
  viewMode,
  sortBy,
  onViewModeChange,
  onSortChange,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const drawerContentRef = useRef<HTMLDivElement>(null);

  // Get current filter values from URL
  const currentTypes = searchParams.get("type")?.split(",").filter(Boolean) || [];
  const currentHoods = searchParams.get("hood")?.split(",").filter(Boolean) || [];
  const currentVibes = searchParams.get("vibe")?.split(",").filter(Boolean) || [];

  const activeFilterCount = currentTypes.length + currentHoods.length + currentVibes.length;

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.overflow = "hidden";
      if (drawerContentRef.current) {
        drawerContentRef.current.scrollTop = 0;
      }
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || "0", 10) * -1);
      }
    }
    return () => {
      const scrollY = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || "0", 10) * -1);
      }
    };
  }, [drawerOpen]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const updateFilters = (updates: Record<string, string | null>) => {
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
  };

  const toggleType = (type: string) => {
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter((t) => t !== type)
      : [...currentTypes, type];
    updateFilters({ type: newTypes.length > 0 ? newTypes.join(",") : null });
  };

  const toggleHood = (hood: string) => {
    const newHoods = currentHoods.includes(hood)
      ? currentHoods.filter((h) => h !== hood)
      : [...currentHoods, hood];
    updateFilters({ hood: newHoods.length > 0 ? newHoods.join(",") : null });
  };

  const toggleVibe = (vibe: string) => {
    const newVibes = currentVibes.includes(vibe)
      ? currentVibes.filter((v) => v !== vibe)
      : [...currentVibes, vibe];
    updateFilters({ vibe: newVibes.length > 0 ? newVibes.join(",") : null });
  };

  const clearAllFilters = () => {
    updateFilters({ type: null, hood: null, vibe: null });
  };

  return (
    <>
      <div className="sticky top-[104px] z-30 bg-[var(--night)] border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            {/* View mode tabs - styled like MainNav */}
            <div className="flex gap-1 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => onViewModeChange("type")}
                className={`nav-tab relative px-4 py-2 rounded-md font-mono text-sm whitespace-nowrap transition-all duration-300 ${
                  viewMode === "type"
                    ? "nav-tab-active text-[var(--void)] font-medium"
                    : "text-[var(--muted)] hover:text-[var(--neon-amber)] border border-transparent"
                }`}
              >
                Category
              </button>
              <button
                onClick={() => onViewModeChange("neighborhood")}
                className={`nav-tab relative px-4 py-2 rounded-md font-mono text-sm whitespace-nowrap transition-all duration-300 ${
                  viewMode === "neighborhood"
                    ? "nav-tab-active text-[var(--void)] font-medium"
                    : "text-[var(--muted)] hover:text-[var(--neon-amber)] border border-transparent"
                }`}
              >
                Hood
              </button>
              <button
                onClick={() => onViewModeChange("list")}
                className={`nav-tab relative px-4 py-2 rounded-md font-mono text-sm whitespace-nowrap transition-all duration-300 ${
                  viewMode === "list"
                    ? "nav-tab-active text-[var(--void)] font-medium"
                    : "text-[var(--muted)] hover:text-[var(--neon-amber)] border border-transparent"
                }`}
              >
                List
              </button>
            </div>

            {/* Sort tabs - only show in list view */}
            {viewMode === "list" && (
              <div className="flex gap-1 border-l border-[var(--twilight)] pl-3 ml-2">
                <button
                  onClick={() => onSortChange("events")}
                  className={`nav-tab relative px-3 py-2 rounded-md font-mono text-xs whitespace-nowrap transition-all duration-300 ${
                    sortBy === "events"
                      ? "nav-tab-active text-[var(--void)] font-medium"
                      : "text-[var(--muted)] hover:text-[var(--neon-amber)] border border-transparent"
                  }`}
                >
                  Events
                </button>
                <button
                  onClick={() => onSortChange("alpha")}
                  className={`nav-tab relative px-3 py-2 rounded-md font-mono text-xs whitespace-nowrap transition-all duration-300 ${
                    sortBy === "alpha"
                      ? "nav-tab-active text-[var(--void)] font-medium"
                      : "text-[var(--muted)] hover:text-[var(--neon-amber)] border border-transparent"
                  }`}
                >
                  A-Z
                </button>
                <button
                  onClick={() => onSortChange("closest")}
                  className={`nav-tab relative px-3 py-2 rounded-md font-mono text-xs whitespace-nowrap transition-all duration-300 ${
                    sortBy === "closest"
                      ? "nav-tab-active text-[var(--void)] font-medium"
                      : "text-[var(--muted)] hover:text-[var(--neon-amber)] border border-transparent"
                  }`}
                >
                  Closest
                </button>
              </div>
            )}

            {/* Filter button */}
            <button
              onClick={() => setDrawerOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md font-mono text-sm transition-colors ml-auto ${
                activeFilterCount > 0
                  ? "bg-[var(--coral)] text-[var(--void)]"
                  : "text-[var(--muted)] hover:text-[var(--neon-amber)] hover:bg-[var(--twilight)]/30"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filter
              {activeFilterCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-[var(--void)] text-[var(--coral)] text-[0.6rem] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Filter Drawer Overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-[1100] bg-black/60 touch-none"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Filter Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-[1101] w-80 max-w-[85vw] border-r border-[var(--twilight)] transform transition-transform duration-200 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ backgroundColor: "var(--void)" }}
      >
        <div className="flex flex-col h-full">
          {/* Drawer Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--twilight)]">
            <span className="font-mono text-sm font-medium text-[var(--cream)]">Filters</span>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="font-mono text-xs text-[var(--coral)] hover:text-[var(--rose)] transition-colors"
                >
                  Clear all
                </button>
              )}
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2.5 text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50 rounded-lg transition-colors active:scale-95"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Drawer Content */}
          <div ref={drawerContentRef} className="flex-1 overflow-y-auto overscroll-contain">
            {/* Type Filter */}
            <FilterSection
              title="Type"
              activeFilters={currentTypes}
              expanded={expandedSections.has("type")}
              onToggle={() => toggleSection("type")}
            >
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(SPOT_TYPES).map(([value, config]) => {
                  const isActive = currentTypes.includes(value);
                  return (
                    <button
                      key={value}
                      onClick={() => toggleType(value)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-all ${
                        isActive
                          ? "bg-[var(--cream)] text-[var(--void)]"
                          : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                      }`}
                    >
                      <CategoryIcon
                        type={value}
                        size={12}
                        style={{ color: isActive ? "var(--void)" : CATEGORY_CONFIG[value as CategoryType]?.color }}
                        glow={isActive ? "none" : "subtle"}
                      />
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </FilterSection>

            {/* Neighborhood Filter */}
            <FilterSection
              title="Neighborhood"
              activeFilters={currentHoods}
              expanded={expandedSections.has("neighborhood")}
              onToggle={() => toggleSection("neighborhood")}
            >
              <div className="flex flex-wrap gap-1.5">
                {NEIGHBORHOODS.map((hood) => {
                  const isActive = currentHoods.includes(hood);
                  return (
                    <button
                      key={hood}
                      onClick={() => toggleHood(hood)}
                      className={`px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-colors ${
                        isActive
                          ? "bg-[var(--neon-cyan)] text-[var(--void)]"
                          : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                      }`}
                    >
                      {hood}
                    </button>
                  );
                })}
              </div>
            </FilterSection>

            {/* Vibes Filter */}
            <FilterSection
              title="Vibes"
              activeFilters={currentVibes}
              expanded={expandedSections.has("vibes")}
              onToggle={() => toggleSection("vibes")}
            >
              {Object.entries(VIBE_GROUPS).map(([groupName, vibes]) => (
                <div key={groupName} className="mb-3 last:mb-0">
                  <div className="font-mono text-[0.55rem] text-[var(--muted)] mb-1.5">{groupName}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {vibes.map((vibe) => {
                      const isActive = currentVibes.includes(vibe.value);
                      return (
                        <button
                          key={vibe.value}
                          onClick={() => toggleVibe(vibe.value)}
                          className={`px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-colors ${
                            isActive
                              ? "bg-[var(--lavender)] text-[var(--void)]"
                              : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                          }`}
                        >
                          {vibe.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </FilterSection>
          </div>

          {/* Drawer Footer */}
          <div className="px-4 py-3 border-t border-[var(--twilight)]">
            <button
              onClick={() => setDrawerOpen(false)}
              className="w-full py-2.5 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors active:scale-[0.98]"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
