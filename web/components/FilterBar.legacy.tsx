"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useMemo, useState, useEffect, useRef, useTransition } from "react";
import { CATEGORIES, SUBCATEGORIES, DATE_FILTERS, PRICE_FILTERS, TAG_GROUPS, type AvailableFilters } from "@/lib/search";
import { PREFERENCE_VIBES, PREFERENCE_NEIGHBORHOODS } from "@/lib/preferences";
import { MOODS, getMoodById, type MoodId } from "@/lib/moods";
import CategoryIcon, { CATEGORY_CONFIG, type CategoryType } from "./CategoryIcon";
import { useFilterPersistence } from "@/hooks/useFilterPersistence";
import SavedFiltersMenu from "./SavedFiltersMenu";

type FilterBarProps = {
  variant?: "full" | "compact";
};

// Active filter chip type
type ActiveFilterChip = {
  label: string;
  onRemove: () => void;
  className?: string;
  style?: React.CSSProperties;
};

// Collapsible section component with inline active filters
function FilterSection({
  title,
  expanded,
  onToggle,
  activeFilters = [],
  children
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  activeFilters?: ActiveFilterChip[];
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-[var(--twilight)]/50 last:border-b-0">
      {/* Header row - always clickable to expand/collapse */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--twilight)]/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium text-[var(--cream)]">{title}</span>
          {activeFilters.length > 0 && !expanded && (
            <span className="px-1.5 py-0.5 rounded-full bg-[var(--coral)] text-[var(--void)] text-[0.6rem] font-mono font-medium">
              {activeFilters.length}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-[var(--muted)] transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Active filter pills - visible when collapsed */}
      {!expanded && activeFilters.length > 0 && (
        <div className="px-4 pb-3 -mt-1 flex flex-wrap gap-1.5">
          {activeFilters.map((chip) => (
            <button
              key={chip.label}
              onClick={(e) => {
                e.stopPropagation();
                chip.onRemove();
              }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.65rem] font-mono font-medium transition-colors hover:opacity-80 ${chip.className || "bg-[var(--twilight)] text-[var(--cream)]"}`}
              style={chip.style}
            >
              {chip.label}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ))}
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}

// Filter drawer footer with persistence
function FilterFooter({ hasFilters, clearAll }: { hasFilters: boolean; clearAll: () => void }) {
  const { hasSavedFilters, restoreFilters } = useFilterPersistence();
  const showRestore = !hasFilters && hasSavedFilters();

  if (!hasFilters && !showRestore) return null;

  return (
    <div className="px-4 py-3 border-t border-[var(--twilight)] space-y-2">
      {hasFilters && (
        <button
          onClick={clearAll}
          className="w-full px-3 py-2 rounded-lg font-mono text-xs font-medium text-[var(--coral)] hover:text-[var(--rose)] border border-[var(--twilight)] hover:border-[var(--coral)]/50 transition-colors"
        >
          Clear all filters
        </button>
      )}
      {showRestore && (
        <button
          onClick={restoreFilters}
          className="w-full px-3 py-2 rounded-lg font-mono text-xs font-medium text-[var(--neon-cyan)] hover:text-[var(--cream)] border border-[var(--twilight)] hover:border-[var(--neon-cyan)]/50 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Restore saved filters
        </button>
      )}
    </div>
  );
}

export default function FilterBar({ variant = "full" }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerContentRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();

  // Optimistic view state for instant UI feedback
  const [optimisticView, setOptimisticView] = useState<string | null>(null);

  // Available filters from API (dynamically generated from events)
  const [availableFilters, setAvailableFilters] = useState<AvailableFilters | null>(null);

  // Fetch available filters on mount
  useEffect(() => {
    fetch("/api/filters")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        // Validate the response has expected structure
        if (data.categories && Array.isArray(data.categories)) {
          setAvailableFilters(data);
        } else {
          console.error("Invalid filters response:", data);
        }
      })
      .catch((err) => console.error("Failed to fetch available filters:", err));
  }, []);

  // Helper to check if a filter value has events
  // Note: Always return true since available_filters counts aren't reliably populated
  const categoryHasEvents = useCallback(
    (_value: string) => {
      return true; // Show all categories - counts not reliably available
    },
    []
  );

  // Note: Always return true since available_filters counts aren't reliably populated
  const tagHasEvents = useCallback(
    (_value: string) => {
      return true; // Show all tags - counts not reliably available
    },
    []
  );

  // Get event count for a category
  const getCategoryCount = useCallback(
    (value: string) => {
      if (!availableFilters) return null;
      const cat = availableFilters.categories.find((c) => c.value === value);
      return cat?.count || 0;
    },
    [availableFilters]
  );

  // Get event count for a tag
  const getTagCount = useCallback(
    (value: string) => {
      if (!availableFilters) return null;
      const tag = availableFilters.tags.find((t) => t.value === value);
      return tag?.count || 0;
    },
    [availableFilters]
  );

  // Track which filter sections are expanded (none expanded by default)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Toggle a section's expanded state
  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  // View mode (list or map) - use optimistic state when pending for instant feedback
  const urlView = searchParams.get("view") || "events";
  const currentView = optimisticView || urlView;

  // Reset optimistic state when URL catches up
  useEffect(() => {
    if (optimisticView && urlView === optimisticView) {
      setOptimisticView(null);
    }
  }, [urlView, optimisticView]);

  // Custom range states
  const [showDateRange, setShowDateRange] = useState(false);
  const [showPriceRange, setShowPriceRange] = useState(false);
  const [showGeoRange, setShowGeoRange] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  const currentCategories = useMemo(
    () => searchParams.get("categories")?.split(",").filter(Boolean) || [],
    [searchParams]
  );
  const currentSubcategories = useMemo(
    () => searchParams.get("subcategories")?.split(",").filter(Boolean) || [],
    [searchParams]
  );
  const currentTags = useMemo(
    () => searchParams.get("tags")?.split(",").filter(Boolean) || [],
    [searchParams]
  );
  const currentVibes = useMemo(
    () => searchParams.get("vibes")?.split(",").filter(Boolean) || [],
    [searchParams]
  );
  const currentNeighborhoods = useMemo(
    () => searchParams.get("neighborhoods")?.split(",").filter(Boolean) || [],
    [searchParams]
  );
  const currentPriceFilter = searchParams.get("price") || "";
  const currentDateFilter = searchParams.get("date") || "";
  const currentMood = (searchParams.get("mood") as MoodId) || null;

  // Auto-expand vibe section if mood/vibes/tags are active
  useEffect(() => {
    if (currentMood || currentVibes.length > 0 || currentTags.length > 0) {
      setExpandedSections(prev => new Set([...prev, "vibe"]));
    }
  }, [currentMood, currentTags.length, currentVibes.length]);

  // Lock body scroll and reset drawer scroll when opened
  // Uses fixed positioning for iOS compatibility
  useEffect(() => {
    if (drawerOpen) {
      // Store current scroll position
      const scrollY = window.scrollY;
      // Lock body with fixed position (works on iOS)
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.overflow = "hidden";
      // Reset drawer content scroll
      if (drawerContentRef.current) {
        drawerContentRef.current.scrollTop = 0;
      }
    } else {
      // Restore scroll position
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

  // Custom ranges
  const currentDateStart = searchParams.get("date_start") || "";
  const currentDateEnd = searchParams.get("date_end") || "";
  const currentPriceMin = searchParams.get("price_min") || "";
  const currentPriceMax = searchParams.get("price_max") || "";
  const currentGeoLat = searchParams.get("geo_lat") || "";
  const currentGeoLng = searchParams.get("geo_lng") || "";
  const currentGeoRadius = searchParams.get("geo_radius") || "5";

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
      params.delete("page");
      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      // Use startTransition to make navigation non-blocking for instant UI feedback
      startTransition(() => {
        router.push(newUrl, { scroll: false });
      });
    },
    [router, pathname, searchParams, startTransition]
  );

  const toggleCategory = useCallback(
    (category: string) => {
      const newCategories = currentCategories.includes(category)
        ? currentCategories.filter((c) => c !== category)
        : [...currentCategories, category];
      const clearedSubcategories = currentCategories.includes(category)
        ? currentSubcategories.filter((s) => !s.startsWith(category + "."))
        : currentSubcategories;
      updateParams({
        categories: newCategories.length > 0 ? newCategories.join(",") : null,
        subcategories: clearedSubcategories.length > 0 ? clearedSubcategories.join(",") : null,
      });
    },
    [currentCategories, currentSubcategories, updateParams]
  );

  const toggleSubcategory = useCallback(
    (subcategory: string) => {
      const newSubcategories = currentSubcategories.includes(subcategory)
        ? currentSubcategories.filter((s) => s !== subcategory)
        : [...currentSubcategories, subcategory];
      updateParams({
        subcategories: newSubcategories.length > 0 ? newSubcategories.join(",") : null,
      });
    },
    [currentSubcategories, updateParams]
  );

  const toggleTag = useCallback(
    (tag: string) => {
      const newTags = currentTags.includes(tag)
        ? currentTags.filter((t) => t !== tag)
        : [...currentTags, tag];
      updateParams({ tags: newTags.length > 0 ? newTags.join(",") : null });
    },
    [currentTags, updateParams]
  );

  const toggleVibe = useCallback(
    (vibe: string) => {
      const newVibes = currentVibes.includes(vibe)
        ? currentVibes.filter((v) => v !== vibe)
        : [...currentVibes, vibe];
      updateParams({ vibes: newVibes.length > 0 ? newVibes.join(",") : null });
    },
    [currentVibes, updateParams]
  );

  const toggleNeighborhood = useCallback(
    (neighborhood: string) => {
      const newNeighborhoods = currentNeighborhoods.includes(neighborhood)
        ? currentNeighborhoods.filter((n) => n !== neighborhood)
        : [...currentNeighborhoods, neighborhood];
      updateParams({
        neighborhoods: newNeighborhoods.length > 0 ? newNeighborhoods.join(",") : null,
      });
    },
    [currentNeighborhoods, updateParams]
  );

  const setMood = useCallback(
    (mood: MoodId | null) => {
      updateParams({ mood: mood === currentMood ? null : mood });
    },
    [currentMood, updateParams]
  );

  const clearAll = useCallback(() => {
    updateParams({
      categories: null,
      subcategories: null,
      tags: null,
      vibes: null,
      neighborhoods: null,
      date: null,
      date_start: null,
      date_end: null,
      price: null,
      price_min: null,
      price_max: null,
      mood: null,
      geo_lat: null,
      geo_lng: null,
      geo_radius: null,
    });
  }, [updateParams]);

  const setPriceFilter = useCallback(
    (price: string) => {
      updateParams({
        price: currentPriceFilter === price ? null : price,
        price_min: null,
        price_max: null,
      });
      setShowPriceRange(false);
    },
    [currentPriceFilter, updateParams]
  );

  const setDateFilter = useCallback(
    (date: string) => {
      updateParams({
        date: currentDateFilter === date ? null : date,
        date_start: null,
        date_end: null,
      });
      setShowDateRange(false);
    },
    [currentDateFilter, updateParams]
  );

  const setCustomDateRange = useCallback(
    (start: string, end: string) => {
      updateParams({
        date: null,
        date_start: start || null,
        date_end: end || null,
      });
    },
    [updateParams]
  );

  const setCustomPriceRange = useCallback(
    (min: string, max: string) => {
      updateParams({
        price: null,
        price_min: min || null,
        price_max: max || null,
      });
    },
    [updateParams]
  );

  const requestNearMe = useCallback(() => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateParams({
          geo_lat: position.coords.latitude.toString(),
          geo_lng: position.coords.longitude.toString(),
          geo_radius: currentGeoRadius,
        });
        setGeoLoading(false);
        setShowGeoRange(true);
      },
      (error) => {
        console.error("Geolocation error:", error);
        alert("Could not get your location. Please enable location services.");
        setGeoLoading(false);
      }
    );
  }, [updateParams, currentGeoRadius]);

  const clearGeo = useCallback(() => {
    updateParams({
      geo_lat: null,
      geo_lng: null,
      geo_radius: null,
    });
    setShowGeoRange(false);
  }, [updateParams]);

  const setViewMode = useCallback(
    (view: "events" | "map" | "calendar") => {
      // Optimistically update UI immediately
      setOptimisticView(view);
      updateParams({ view });
    },
    [updateParams]
  );

  const quickPicks = [
    {
      label: "Happening Now",
      onClick: () => setDateFilter("now"),
      isActive: currentDateFilter === "now",
    },
    {
      label: "Today",
      onClick: () => setDateFilter("today"),
      isActive: currentDateFilter === "today",
    },
    {
      label: "Free",
      onClick: () => setPriceFilter("free"),
      isActive: currentPriceFilter === "free",
    },
    {
      label: "Live Music",
      onClick: () => toggleCategory("music"),
      isActive: currentCategories.includes("music"),
    },
    {
      label: "Family",
      onClick: () => toggleTag("family-friendly"),
      isActive: currentTags.includes("family-friendly"),
    },
    {
      label: "Outdoors",
      onClick: () => toggleTag("outdoor"),
      isActive: currentTags.includes("outdoor"),
    },
  ];

  const availableSubcategories = currentCategories.flatMap((cat) =>
    SUBCATEGORIES[cat]?.map((sub) => ({ ...sub, category: cat })) || []
  );

  const hasFilters = Boolean(
    currentMood || currentCategories.length > 0 || currentSubcategories.length > 0 ||
    currentTags.length > 0 || currentVibes.length > 0 || currentNeighborhoods.length > 0 ||
    currentPriceFilter || currentDateFilter || currentDateStart || currentDateEnd ||
    currentPriceMin || currentPriceMax || currentGeoLat
  );

  const filterCount = (currentMood ? 1 : 0) + currentCategories.length + currentSubcategories.length +
    currentTags.length + currentVibes.length + currentNeighborhoods.length +
    (currentPriceFilter ? 1 : 0) + (currentDateFilter ? 1 : 0) +
    ((currentDateStart || currentDateEnd) ? 1 : 0) +
    ((currentPriceMin || currentPriceMax) ? 1 : 0) +
    (currentGeoLat ? 1 : 0);

  // Check if custom date range is active
  const hasCustomDateRange = currentDateStart || currentDateEnd;
  const hasCustomPriceRange = currentPriceMin || currentPriceMax;
  const hasGeoFilter = currentGeoLat && currentGeoLng;

  const activeChips = useMemo(() => {
    const chips: { label: string; onClick: () => void; className: string; style?: { backgroundColor?: string } }[] = [];

    currentCategories.forEach((cat) => {
      const label = CATEGORIES.find((c) => c.value === cat)?.label || cat;
      chips.push({
        label,
        onClick: () => toggleCategory(cat),
        className: "bg-[var(--twilight)] text-[var(--cream)]",
      });
    });

    if (currentDateFilter) {
      chips.push({
        label: DATE_FILTERS.find((d) => d.value === currentDateFilter)?.label || currentDateFilter,
        onClick: () => setDateFilter(currentDateFilter),
        className: "bg-[var(--gold)] text-[var(--void)]",
      });
    }

    if (hasCustomDateRange) {
      chips.push({
        label:
          currentDateStart && currentDateEnd
            ? `${currentDateStart} - ${currentDateEnd}`
            : currentDateStart
            ? `From ${currentDateStart}`
            : `Until ${currentDateEnd}`,
        onClick: () => setCustomDateRange("", ""),
        className: "bg-[var(--gold)] text-[var(--void)]",
      });
    }

    if (currentPriceFilter) {
      chips.push({
        label: PRICE_FILTERS.find((p) => p.value === currentPriceFilter)?.label || currentPriceFilter,
        onClick: () => setPriceFilter(currentPriceFilter),
        className: "bg-[var(--neon-green)] text-[var(--void)]",
      });
    }

    if (hasCustomPriceRange) {
      chips.push({
        label:
          currentPriceMin && currentPriceMax
            ? `$${currentPriceMin}-${currentPriceMax}`
            : currentPriceMin
            ? `$${currentPriceMin}+`
            : `Under $${currentPriceMax}`,
        onClick: () => setCustomPriceRange("", ""),
        className: "bg-[var(--neon-green)] text-[var(--void)]",
      });
    }

    if (hasGeoFilter) {
      chips.push({
        label: `Near me (${currentGeoRadius}km)`,
        onClick: clearGeo,
        className: "bg-[var(--neon-magenta)] text-[var(--void)]",
      });
    }

    currentNeighborhoods.forEach((n) => {
      chips.push({
        label: n,
        onClick: () => toggleNeighborhood(n),
        className: "bg-[var(--twilight)] text-[var(--cream)]",
      });
    });

    if (currentMood) {
      const mood = getMoodById(currentMood);
      if (mood) {
        chips.push({
          label: `${mood.emoji} ${mood.name}`,
          onClick: () => setMood(null),
          className: "text-[var(--void)]",
          style: { backgroundColor: mood.color },
        });
      }
    }

    currentVibes.forEach((v) => {
      chips.push({
        label: PREFERENCE_VIBES.find((pv) => pv.value === v)?.label || v,
        onClick: () => toggleVibe(v),
        className: "bg-[var(--sage)] text-[var(--void)]",
      });
    });

    currentTags.forEach((t) => {
      chips.push({
        label:
          [...TAG_GROUPS.Vibe, ...TAG_GROUPS.Access, ...TAG_GROUPS.Special].find((tg) => tg.value === t)?.label || t,
        onClick: () => toggleTag(t),
        className: "bg-[var(--lavender)] text-[var(--void)]",
      });
    });

    return chips;
  }, [
    clearGeo,
    currentCategories,
    currentDateFilter,
    currentDateEnd,
    currentDateStart,
    currentGeoRadius,
    currentMood,
    currentNeighborhoods,
    currentPriceFilter,
    currentPriceMax,
    currentPriceMin,
    currentTags,
    currentVibes,
    hasCustomDateRange,
    hasCustomPriceRange,
    hasGeoFilter,
    setCustomDateRange,
    setCustomPriceRange,
    setDateFilter,
    setMood,
    setPriceFilter,
    toggleCategory,
    toggleNeighborhood,
    toggleTag,
    toggleVibe,
  ]);

  const visibleChips = activeChips.slice(0, 3);
  const extraChipCount = Math.max(activeChips.length - visibleChips.length, 0);

  // Section-specific active filters for collapsed state
  const categoryActiveFilters: ActiveFilterChip[] = useMemo(() => [
    ...currentCategories.map(cat => ({
      label: CATEGORIES.find(c => c.value === cat)?.label || cat,
      onRemove: () => toggleCategory(cat),
      className: "bg-[var(--cream)] text-[var(--void)]",
    })),
    ...currentSubcategories.map(sub => ({
      label: SUBCATEGORIES[sub.split('.')[0]]?.find(s => s.value === sub)?.label || sub,
      onRemove: () => toggleSubcategory(sub),
      className: "bg-[var(--coral)] text-[var(--void)]",
    })),
  ], [currentCategories, currentSubcategories, toggleCategory, toggleSubcategory]);

  const whenActiveFilters: ActiveFilterChip[] = useMemo(() => {
    const filters: ActiveFilterChip[] = [];
    if (currentDateFilter) {
      filters.push({
        label: DATE_FILTERS.find(d => d.value === currentDateFilter)?.label || currentDateFilter,
        onRemove: () => setDateFilter(currentDateFilter),
        className: "bg-[var(--gold)] text-[var(--void)]",
      });
    }
    if (hasCustomDateRange) {
      filters.push({
        label: currentDateStart && currentDateEnd
          ? `${currentDateStart} - ${currentDateEnd}`
          : currentDateStart ? `From ${currentDateStart}` : `Until ${currentDateEnd}`,
        onRemove: () => setCustomDateRange("", ""),
        className: "bg-[var(--gold)] text-[var(--void)]",
      });
    }
    return filters;
  }, [currentDateFilter, hasCustomDateRange, currentDateStart, currentDateEnd, setDateFilter, setCustomDateRange]);

  const priceActiveFilters: ActiveFilterChip[] = useMemo(() => {
    const filters: ActiveFilterChip[] = [];
    if (currentPriceFilter) {
      filters.push({
        label: PRICE_FILTERS.find(p => p.value === currentPriceFilter)?.label || currentPriceFilter,
        onRemove: () => setPriceFilter(currentPriceFilter),
        className: "bg-[var(--neon-green)] text-[var(--void)]",
      });
    }
    if (hasCustomPriceRange) {
      filters.push({
        label: currentPriceMin && currentPriceMax
          ? `$${currentPriceMin}-${currentPriceMax}`
          : currentPriceMin ? `$${currentPriceMin}+` : `Under $${currentPriceMax}`,
        onRemove: () => setCustomPriceRange("", ""),
        className: "bg-[var(--neon-green)] text-[var(--void)]",
      });
    }
    return filters;
  }, [currentPriceFilter, hasCustomPriceRange, currentPriceMin, currentPriceMax, setPriceFilter, setCustomPriceRange]);

  const areaActiveFilters: ActiveFilterChip[] = useMemo(() => {
    const filters: ActiveFilterChip[] = [];
    if (hasGeoFilter) {
      filters.push({
        label: `Near me (${currentGeoRadius}km)`,
        onRemove: clearGeo,
        className: "bg-[var(--neon-magenta)] text-[var(--void)]",
      });
    }
    currentNeighborhoods.forEach(n => {
      filters.push({
        label: n,
        onRemove: () => toggleNeighborhood(n),
        className: "bg-[var(--coral)] text-[var(--void)]",
      });
    });
    return filters;
  }, [hasGeoFilter, currentGeoRadius, currentNeighborhoods, clearGeo, toggleNeighborhood]);

  const vibeActiveFilters: ActiveFilterChip[] = useMemo(() => {
    const filters: ActiveFilterChip[] = [];
    if (currentMood) {
      const mood = getMoodById(currentMood);
      if (mood) {
        filters.push({
          label: `${mood.emoji} ${mood.name}`,
          onRemove: () => setMood(null),
          className: "text-[var(--void)]",
          style: { backgroundColor: mood.color },
        });
      }
    }
    currentVibes.forEach(v => {
      filters.push({
        label: PREFERENCE_VIBES.find(pv => pv.value === v)?.label || v,
        onRemove: () => toggleVibe(v),
        className: "bg-[var(--sage)] text-[var(--void)]",
      });
    });
    currentTags.forEach(t => {
      filters.push({
        label: [...TAG_GROUPS.Vibe, ...TAG_GROUPS.Access, ...TAG_GROUPS.Special].find(tg => tg.value === t)?.label || t,
        onRemove: () => toggleTag(t),
        className: "bg-[var(--lavender)] text-[var(--void)]",
      });
    });
    return filters;
  }, [currentMood, currentVibes, currentTags, setMood, toggleVibe, toggleTag]);

  return (
    <>
      {/* Filter bar */}
      <div className="sticky top-[104px] z-30 bg-[var(--night)] border-b border-[var(--twilight)]">
        <div className={`max-w-3xl mx-auto px-4 ${variant === "compact" ? "py-1.5" : "py-2"}`}>
          <div className="flex items-center gap-2">
            {/* List/Calendar/Map view toggle */}
            <div className="flex rounded-full bg-[var(--twilight)] p-0.5">
              <button
                onClick={() => setViewMode("events")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-all ${
                  currentView === "events" || currentView === "list"
                    ? "bg-[var(--cream)] text-[var(--void)]"
                    : "text-[var(--muted)] hover:text-[var(--cream)]"
                }`}
                aria-label="List view"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-all ${
                  currentView === "calendar"
                    ? "bg-[var(--cream)] text-[var(--void)]"
                    : "text-[var(--muted)] hover:text-[var(--cream)]"
                }`}
                aria-label="Calendar view"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">Cal</span>
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-all ${
                  currentView === "map"
                    ? "bg-[var(--cream)] text-[var(--void)]"
                    : "text-[var(--muted)] hover:text-[var(--cream)]"
                }`}
                aria-label="Map view"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <span className="hidden sm:inline">Map</span>
              </button>
            </div>

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

            {/* Saved filters menu */}
            <SavedFiltersMenu variant={variant === "compact" ? "compact" : "full"} />

            {/* Active filter chips (compact summary) */}
            {hasFilters && !drawerOpen && variant === "full" && (
              <div className="flex items-center gap-1.5 overflow-x-auto flex-1 scrollbar-hide">
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--twilight)] text-[0.65rem] font-mono font-medium text-[var(--cream)] whitespace-nowrap"
                >
                  Active {filterCount}
                </button>
                {visibleChips.map((chip) => (
                  <button
                    key={chip.label}
                    onClick={chip.onClick}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-[0.65rem] font-mono font-medium whitespace-nowrap ${chip.className}`}
                    style={chip.style}
                  >
                    {chip.label}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ))}
                {extraChipCount > 0 && (
                  <button
                    onClick={() => setDrawerOpen(true)}
                    className="px-2 py-1 rounded-full bg-[var(--twilight)] text-[0.65rem] font-mono font-medium text-[var(--muted)] whitespace-nowrap"
                  >
                    +{extraChipCount} more
                  </button>
                )}
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
        <div
          className="fixed inset-0 z-[1100] bg-black/60 touch-none"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-[1101] w-80 max-w-[85vw] border-r border-[var(--twilight)] transform transition-transform duration-200 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ backgroundColor: "var(--void)" }}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--twilight)]">
            <span className="font-mono text-sm font-medium text-[var(--cream)]">Filters</span>
            <button
              onClick={() => setDrawerOpen(false)}
              className="p-2.5 -mr-2 text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50 rounded-lg transition-colors active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div ref={drawerContentRef} className="flex-1 overflow-y-auto overscroll-contain">
            {/* Active Filters - Always visible at top when filters are active */}
            {activeChips.length > 0 && (
              <div className="px-4 py-3 border-b border-[var(--twilight)] bg-[var(--twilight)]/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider">Active Filters</span>
                  <button
                    onClick={clearAll}
                    className="font-mono text-[0.6rem] text-[var(--coral)] hover:text-[var(--rose)]"
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeChips.map((chip) => (
                    <button
                      key={chip.label}
                      onClick={chip.onClick}
                      className={`flex items-center gap-1 px-2 py-1 rounded-full text-[0.65rem] font-mono font-medium ${chip.className}`}
                      style={chip.style}
                    >
                      {chip.label}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Picks - Always visible */}
            <div className="px-4 py-3 border-b border-[var(--twilight)]/50">
              <div className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-wider mb-2">Quick Picks</div>
              <div className="flex flex-wrap gap-1.5">
                {quickPicks.map((pick) => (
                  <button
                    key={pick.label}
                    onClick={pick.onClick}
                    className={`px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-colors ${
                      pick.isActive
                        ? "bg-[var(--cream)] text-[var(--void)]"
                        : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                    }`}
                  >
                    {pick.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Collapsible Filter Sections */}
            <FilterSection
              title="Category"
              activeFilters={categoryActiveFilters}
              expanded={expandedSections.has("category")}
              onToggle={() => toggleSection("category")}
            >
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.filter((cat) => categoryHasEvents(cat.value)).map((cat) => {
                  const isActive = currentCategories.includes(cat.value);
                  const count = getCategoryCount(cat.value);
                  return (
                    <button
                      key={cat.value}
                      onClick={() => toggleCategory(cat.value)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-all ${
                        isActive
                          ? "bg-[var(--cream)] text-[var(--void)]"
                          : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                      }`}
                    >
                      <CategoryIcon
                        type={cat.value}
                        size={12}
                        style={{ color: isActive ? "var(--void)" : CATEGORY_CONFIG[cat.value as CategoryType]?.color }}
                        glow={isActive ? "none" : "subtle"}
                      />
                      {cat.label}
                      {count !== null && count > 0 && !isActive && (
                        <span className="text-[0.55rem] opacity-60">{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Subcategories (Genre) - only show if categories selected */}
              {availableSubcategories.length > 0 && (
                <div className="mt-3">
                  <div className="font-mono text-[0.55rem] text-[var(--muted)] mb-1.5">Genre</div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableSubcategories.map((sub) => (
                      <button
                        key={sub.value}
                        onClick={() => toggleSubcategory(sub.value)}
                        className={`px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-colors ${
                          currentSubcategories.includes(sub.value)
                            ? "bg-[var(--coral)] text-[var(--void)]"
                            : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </FilterSection>

            <FilterSection
              title="When"
              activeFilters={whenActiveFilters}
              expanded={expandedSections.has("when")}
              onToggle={() => toggleSection("when")}
            >
              <div className="flex flex-wrap gap-1.5">
                {DATE_FILTERS.map((df) => (
                  <button
                    key={df.value}
                    onClick={() => setDateFilter(df.value)}
                    className={`px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-colors ${
                      currentDateFilter === df.value
                        ? "bg-[var(--gold)] text-[var(--void)]"
                        : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                    }`}
                  >
                    {df.label}
                  </button>
                ))}
                <button
                  onClick={() => setShowDateRange(!showDateRange)}
                  className={`px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-colors ${
                    hasCustomDateRange
                      ? "bg-[var(--gold)] text-[var(--void)]"
                      : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                  }`}
                >
                  Custom Range
                </button>
              </div>
              {showDateRange && (
                <div className="mt-2 p-3 rounded-lg space-y-2" style={{ backgroundColor: "var(--card-bg)" }}>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-[0.55rem] text-[var(--muted)] mb-1">From</label>
                      <input
                        type="date"
                        value={currentDateStart}
                        onChange={(e) => setCustomDateRange(e.target.value, currentDateEnd)}
                        className="w-full px-2 py-1 rounded bg-[var(--twilight)] text-[var(--cream)] text-xs font-mono border-none"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[0.55rem] text-[var(--muted)] mb-1">To</label>
                      <input
                        type="date"
                        value={currentDateEnd}
                        onChange={(e) => setCustomDateRange(currentDateStart, e.target.value)}
                        className="w-full px-2 py-1 rounded bg-[var(--twilight)] text-[var(--cream)] text-xs font-mono border-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </FilterSection>

            <FilterSection
              title="Price"
              activeFilters={priceActiveFilters}
              expanded={expandedSections.has("price")}
              onToggle={() => toggleSection("price")}
            >
              <div className="flex flex-wrap gap-1.5">
                {PRICE_FILTERS.map((pf) => (
                  <button
                    key={pf.value}
                    onClick={() => setPriceFilter(pf.value)}
                    className={`px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-colors ${
                      currentPriceFilter === pf.value
                        ? "bg-[var(--neon-green)] text-[var(--void)]"
                        : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                    }`}
                  >
                    {pf.label}
                  </button>
                ))}
                <button
                  onClick={() => setShowPriceRange(!showPriceRange)}
                  className={`px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-colors ${
                    hasCustomPriceRange
                      ? "bg-[var(--neon-green)] text-[var(--void)]"
                      : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                  }`}
                >
                  Custom Range
                </button>
              </div>
              {showPriceRange && (
                <div className="mt-2 p-3 rounded-lg space-y-2" style={{ backgroundColor: "var(--card-bg)" }}>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <label className="block text-[0.55rem] text-[var(--muted)] mb-1">Min ($)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={currentPriceMin}
                        onChange={(e) => setCustomPriceRange(e.target.value, currentPriceMax)}
                        className="w-full px-2 py-1 rounded bg-[var(--twilight)] text-[var(--cream)] text-xs font-mono border-none"
                      />
                    </div>
                    <span className="text-[var(--muted)] pt-4">-</span>
                    <div className="flex-1">
                      <label className="block text-[0.55rem] text-[var(--muted)] mb-1">Max ($)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Any"
                        value={currentPriceMax}
                        onChange={(e) => setCustomPriceRange(currentPriceMin, e.target.value)}
                        className="w-full px-2 py-1 rounded bg-[var(--twilight)] text-[var(--cream)] text-xs font-mono border-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </FilterSection>

            <FilterSection
              title="Area"
              activeFilters={areaActiveFilters}
              expanded={expandedSections.has("area")}
              onToggle={() => toggleSection("area")}
            >
              <div className="flex flex-wrap gap-1.5 mb-2">
                <button
                  onClick={hasGeoFilter ? clearGeo : requestNearMe}
                  disabled={geoLoading}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-colors ${
                    hasGeoFilter
                      ? "bg-[var(--neon-magenta)] text-[var(--void)]"
                      : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                  } ${geoLoading ? "opacity-50" : ""}`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {geoLoading ? "Locating..." : hasGeoFilter ? "Near Me (On)" : "Near Me"}
                </button>
              </div>
              {hasGeoFilter && (
                <div className="mb-3 p-3 rounded-lg" style={{ backgroundColor: "var(--card-bg)" }}>
                  <label className="block text-[0.55rem] text-[var(--muted)] mb-2">Distance (km)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="1"
                      max="25"
                      value={currentGeoRadius}
                      onChange={(e) => updateParams({ geo_radius: e.target.value })}
                      className="flex-1 accent-[var(--neon-magenta)]"
                    />
                    <span className="text-xs font-mono text-[var(--cream)] w-8">{currentGeoRadius}km</span>
                  </div>
                </div>
              )}
              <div className="font-mono text-[0.55rem] text-[var(--muted)] mb-1.5">Neighborhoods</div>
              <div className="flex flex-wrap gap-1.5">
                {PREFERENCE_NEIGHBORHOODS.map((n) => (
                  <button
                    key={n}
                    onClick={() => toggleNeighborhood(n)}
                    className={`px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-colors ${
                      currentNeighborhoods.includes(n)
                        ? "bg-[var(--coral)] text-[var(--void)]"
                        : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </FilterSection>

            <FilterSection
              title="Vibe"
              activeFilters={vibeActiveFilters}
              expanded={expandedSections.has("vibe")}
              onToggle={() => toggleSection("vibe")}
            >
              {/* Mood quick-picks */}
              <div className="mb-3">
                <div className="font-mono text-[0.55rem] text-[var(--muted)] mb-1.5">I'm feeling...</div>
                <div className="flex flex-wrap gap-1.5">
                  {MOODS.map((mood) => {
                    const isSelected = currentMood === mood.id;
                    return (
                      <button
                        key={mood.id}
                        onClick={() => setMood(mood.id)}
                        className={`px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-all ${
                          isSelected ? "text-[var(--void)]" : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                        }`}
                        style={isSelected ? { backgroundColor: mood.color } : undefined}
                      >
                        {mood.emoji} {mood.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Atmosphere vibes */}
              <div className="mb-3">
                <div className="font-mono text-[0.55rem] text-[var(--muted)] mb-1.5">Atmosphere</div>
                <div className="flex flex-wrap gap-1.5">
                  {PREFERENCE_VIBES.filter(v => v.group === "Atmosphere").map((v) => (
                    <button
                      key={v.value}
                      onClick={() => toggleVibe(v.value)}
                      className={`px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-colors ${
                        currentVibes.includes(v.value)
                          ? "bg-[var(--sage)] text-[var(--void)]"
                          : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                  {TAG_GROUPS.Vibe.filter((t) => tagHasEvents(t.value)).map((t) => {
                    const count = getTagCount(t.value);
                    return (
                      <button
                        key={t.value}
                        onClick={() => toggleTag(t.value)}
                        className={`px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-colors ${
                          currentTags.includes(t.value)
                            ? "bg-[var(--lavender)] text-[var(--void)]"
                            : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                        }`}
                      >
                        {t.label}
                        {count !== null && count > 0 && !currentTags.includes(t.value) && (
                          <span className="ml-1 text-[0.55rem] opacity-60">{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Access tags */}
              <div className="mb-3">
                <div className="font-mono text-[0.55rem] text-[var(--muted)] mb-1.5">Access</div>
                <div className="flex flex-wrap gap-1.5">
                  {TAG_GROUPS.Access.filter((t) => tagHasEvents(t.value)).map((t) => {
                    const count = getTagCount(t.value);
                    return (
                      <button
                        key={t.value}
                        onClick={() => toggleTag(t.value)}
                        className={`px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-colors ${
                          currentTags.includes(t.value)
                            ? "bg-[var(--lavender)] text-[var(--void)]"
                            : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                        }`}
                      >
                        {t.label}
                        {count !== null && count > 0 && !currentTags.includes(t.value) && (
                          <span className="ml-1 text-[0.55rem] opacity-60">{count}</span>
                        )}
                      </button>
                    );
                  })}
                  {PREFERENCE_VIBES.filter(v => v.group === "Access").map((v) => (
                    <button
                      key={v.value}
                      onClick={() => toggleVibe(v.value)}
                      className={`px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-colors ${
                        currentVibes.includes(v.value)
                          ? "bg-[var(--sage)] text-[var(--void)]"
                          : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amenities */}
              <div className="mb-3">
                <div className="font-mono text-[0.55rem] text-[var(--muted)] mb-1.5">Amenities</div>
                <div className="flex flex-wrap gap-1.5">
                  {PREFERENCE_VIBES.filter(v => v.group === "Amenities").map((v) => (
                    <button
                      key={v.value}
                      onClick={() => toggleVibe(v.value)}
                      className={`px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-colors ${
                        currentVibes.includes(v.value)
                          ? "bg-[var(--sage)] text-[var(--void)]"
                          : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Special tags */}
              <div>
                <div className="font-mono text-[0.55rem] text-[var(--muted)] mb-1.5">Special</div>
                <div className="flex flex-wrap gap-1.5">
                  {TAG_GROUPS.Special.filter((t) => tagHasEvents(t.value)).map((t) => {
                    const count = getTagCount(t.value);
                    return (
                      <button
                        key={t.value}
                        onClick={() => toggleTag(t.value)}
                        className={`px-2.5 py-1 rounded-full font-mono text-xs font-medium transition-colors ${
                          currentTags.includes(t.value)
                            ? "bg-[var(--lavender)] text-[var(--void)]"
                            : "bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                        }`}
                      >
                        {t.label}
                        {count !== null && count > 0 && !currentTags.includes(t.value) && (
                          <span className="ml-1 text-[0.55rem] opacity-60">{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </FilterSection>
          </div>

          {/* Footer - show Clear all when filters are active, or Restore when saved filters exist */}
          <FilterFooter hasFilters={hasFilters} clearAll={clearAll} />
        </div>
      </div>
    </>
  );
}
