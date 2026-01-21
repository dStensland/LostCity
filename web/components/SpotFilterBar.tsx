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

const SORT_OPTIONS: { value: SortOption; label: string; icon: React.ReactNode }[] = [
  {
    value: "events",
    label: "Most Events",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    value: "alpha",
    label: "A-Z",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
      </svg>
    ),
  },
  {
    value: "closest",
    label: "Closest",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

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
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const drawerContentRef = useRef<HTMLDivElement>(null);

  // Get current filter values from URL
  const currentTypes = searchParams.get("type")?.split(",").filter(Boolean) || [];
  const currentHoods = searchParams.get("hood")?.split(",").filter(Boolean) || [];
  const currentVibes = searchParams.get("vibe")?.split(",").filter(Boolean) || [];

  const activeFilterCount = currentTypes.length + currentHoods.length + currentVibes.length;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSortDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const currentSort = SORT_OPTIONS.find((s) => s.value === sortBy) || SORT_OPTIONS[0];

  return (
    <>
      <div className="sticky top-[104px] z-30 bg-[var(--night)] border-b border-[var(--twilight)]">
        <div className="max-w-3xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            {/* Left side: Filter button + View mode toggle */}
            <div className="flex items-center gap-2">
              {/* Filter button */}
              <button
                onClick={() => setDrawerOpen(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-mono text-[0.65rem] font-medium transition-colors active:scale-95 ${
                  activeFilterCount > 0
                    ? "bg-[var(--coral)] text-[var(--void)]"
                    : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filter
                {activeFilterCount > 0 && (
                  <span className="ml-0.5 px-1 py-0.5 rounded-full bg-[var(--void)] text-[var(--coral)] text-[0.5rem]">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* View mode toggle */}
              <div className="flex items-center gap-0.5 bg-[var(--twilight)]/50 rounded-full p-0.5">
                <button
                  onClick={() => onViewModeChange("type")}
                  className={`px-2.5 py-1.5 rounded-full font-mono text-[0.65rem] font-medium transition-colors ${
                    viewMode === "type"
                      ? "bg-[var(--cream)] text-[var(--void)]"
                      : "text-[var(--muted)] hover:text-[var(--cream)]"
                  }`}
                >
                  Category
                </button>
                <button
                  onClick={() => onViewModeChange("neighborhood")}
                  className={`px-2.5 py-1.5 rounded-full font-mono text-[0.65rem] font-medium transition-colors ${
                    viewMode === "neighborhood"
                      ? "bg-[var(--cream)] text-[var(--void)]"
                      : "text-[var(--muted)] hover:text-[var(--cream)]"
                  }`}
                >
                  Hood
                </button>
                <button
                  onClick={() => onViewModeChange("list")}
                  className={`px-2.5 py-1.5 rounded-full font-mono text-[0.65rem] font-medium transition-colors ${
                    viewMode === "list"
                      ? "bg-[var(--cream)] text-[var(--void)]"
                      : "text-[var(--muted)] hover:text-[var(--cream)]"
                  }`}
                >
                  List
                </button>
              </div>
            </div>

            {/* Sort dropdown - only visible in list view */}
            {viewMode === "list" && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[var(--twilight)] text-[var(--cream)] font-mono text-[0.65rem] font-medium hover:bg-[var(--twilight)]/80 transition-colors"
                >
                  {currentSort.icon}
                  <span>{currentSort.label}</span>
                  <svg
                    className={`w-3 h-3 transition-transform ${sortDropdownOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown menu */}
                {sortDropdownOpen && (
                  <div className="absolute right-0 mt-1 w-36 rounded-lg bg-[var(--night)] border border-[var(--twilight)] shadow-lg overflow-hidden z-50">
                    {SORT_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          onSortChange(option.value);
                          setSortDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 font-mono text-xs transition-colors ${
                          sortBy === option.value
                            ? "bg-[var(--coral)] text-[var(--void)]"
                            : "text-[var(--cream)] hover:bg-[var(--twilight)]"
                        }`}
                      >
                        {option.icon}
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
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
