"use client";

import { useSearchParams, usePathname } from "next/navigation";
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { CATEGORIES, TAG_GROUPS } from "@/lib/search-constants";
import { VIBE_GROUPS } from "@/lib/spots-constants";
import { type FindType } from "@/lib/find-filter-schema";
import { dispatchReplaceState } from "@/lib/hooks/useReplaceStateParams";
import {
  createFindFilterSnapshot,
  diffFindFilterKeys,
  trackFindFilterChange,
  type FindFilterSnapshot,
} from "@/lib/analytics/find-tracking";

// ─── Types ───────────────────────────────────────────────────────────────────

type GroupedOption = {
  group: string;
  options: { value: string; label: string }[];
};

type CategoryOption = {
  value: string;
  label: string;
};

type GenreOption = {
  genre: string;
  display_order: number | null;
  is_format: boolean | null;
};

export interface UseFilterEngineOptions {
  portalId?: string;
  portalSlug?: string;
  portalExclusive?: boolean;
  findType?: FindType;
  enableTracking?: boolean;
}

export interface UseFilterEngineReturn {
  // ─── Parsed filter values ────────────────────
  currentCategories: string[];
  currentGenres: string[];
  currentTags: string[];
  currentVibes: string[];
  currentMood: string;
  currentDateFilter: string;
  effectiveDateFilter: string;
  currentFreeOnly: boolean;
  hasFilters: boolean;
  filterCount: number;

  // ─── Availability data ───────────────────────
  categoryOptions: CategoryOption[];
  tagGroupOptions: GroupedOption[];
  vibeGroupOptions: GroupedOption[];
  moodOptions: { value: string; label: string }[];
  genreOptions: GenreOption[];

  // ─── Actions ─────────────────────────────────
  updateParams: (updates: Record<string, string | null>) => void;
  toggleCategory: (category: string) => void;
  toggleGenre: (genre: string) => void;
  toggleTag: (tag: string) => void;
  toggleVibe: (vibe: string) => void;
  setMoodFilter: (mood: string) => void;
  setDateFilter: (date: string) => void;
  toggleFreeOnly: () => void;
  clearAll: () => void;

  // ─── Transition state ────────────────────────
  isPending: boolean;

  // ─── Snapshot (for external tracking) ────────
  snapshot: FindFilterSnapshot;
}

// ─── Static options ──────────────────────────────────────────────────────────

const TAG_GROUP_OPTIONS: GroupedOption[] = Object.entries(TAG_GROUPS)
  .map(([group, options]) => ({
    group,
    options: options.filter((option) => option.value !== "free"),
  }))
  .filter((group) => group.options.length > 0);

const VIBE_GROUP_OPTIONS: GroupedOption[] = Object.entries(VIBE_GROUPS).map(([group, options]) => ({
  group,
  options: [...options],
}));

function humanize(value: string): string {
  return value
    .replace(/[_-]/g, " ")
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useFilterEngine({
  portalId,
  portalSlug,
  portalExclusive = false,
  findType = "events",
  enableTracking = true,
}: UseFilterEngineOptions): UseFilterEngineReturn {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ─── Local param override ──────────────────────────────────────────────────
  // replaceState does NOT trigger useSearchParams to re-render. We keep a
  // local URLSearchParams that's applied immediately on write, so the UI
  // reflects filter changes instantly. It's cleared once useSearchParams
  // catches up (i.e. when a real navigation or Next.js flush occurs) — but
  // in practice it stays in sync because both read from the same URL.
  const [localParams, setLocalParams] = useState<URLSearchParams | null>(null);

  // The effective params for reading: local override wins while it's present.
  const effectiveParams = localParams ?? searchParams;

  // ─── Availability state ────────────────────────────────────────────────────
  const [genreOptions, setGenreOptions] = useState<GenreOption[]>([]);
  const [availableCategories, setAvailableCategories] = useState<CategoryOption[] | null>(null);
  const [availableTags, setAvailableTags] = useState<Array<{ value: string; label: string; count: number }> | null>(null);
  const prevCategoriesRef = useRef<string[]>([]);
  const prevSnapshotRef = useRef<FindFilterSnapshot | null>(null);

  // ─── Parsed filter values ──────────────────────────────────────────────────
  const currentCategories = useMemo(
    () => effectiveParams.get("categories")?.split(",").filter(Boolean) || [],
    [effectiveParams]
  );
  const currentGenres = useMemo(
    () => effectiveParams.get("genres")?.split(",").filter(Boolean) || [],
    [effectiveParams]
  );
  const currentTags = useMemo(
    () => effectiveParams.get("tags")?.split(",").filter(Boolean) || [],
    [effectiveParams]
  );
  const currentVibes = useMemo(
    () => effectiveParams.get("vibes")?.split(",").filter(Boolean) || [],
    [effectiveParams]
  );
  const currentMood = effectiveParams.get("mood") || "";
  const currentDateFilter = effectiveParams.get("date") || "";
  const effectiveDateFilter = currentDateFilter;
  const currentFreeOnly = effectiveParams.get("free") === "1" || effectiveParams.get("price") === "free";

  const hasFilters =
    currentCategories.length > 0 ||
    currentGenres.length > 0 ||
    currentTags.length > 0 ||
    currentVibes.length > 0 ||
    Boolean(currentDateFilter) ||
    currentFreeOnly;

  const filterCount =
    currentCategories.length +
    currentGenres.length +
    currentTags.length +
    currentVibes.length +
    (currentDateFilter ? 1 : 0) +
    (currentFreeOnly ? 1 : 0);

  // ─── Snapshot for analytics ────────────────────────────────────────────────
  const snapshot = useMemo(
    () => createFindFilterSnapshot(searchParams, findType),
    [searchParams, findType]
  );

  // ─── Category options (merged static + availability) ───────────────────────
  const categoryOptions = useMemo(() => {
    const staticCategoryMap = new Map<string, string>(
      CATEGORIES.map((c) => [c.value, c.label])
    );
    const byValue = new Map<string, CategoryOption>();

    if (availableCategories && availableCategories.length > 0) {
      for (const cat of availableCategories) {
        byValue.set(cat.value, {
          value: cat.value,
          label: cat.label || staticCategoryMap.get(cat.value) || humanize(cat.value),
        });
      }
    } else {
      for (const cat of CATEGORIES) {
        byValue.set(cat.value, { value: cat.value, label: cat.label });
      }
    }

    for (const selected of currentCategories) {
      if (!byValue.has(selected)) {
        byValue.set(selected, {
          value: selected,
          label: staticCategoryMap.get(selected) || humanize(selected),
        });
      }
    }

    const order: string[] = CATEGORIES.map((c) => c.value);
    return Array.from(byValue.values()).sort((a, b) => {
      const aIdx = order.indexOf(a.value);
      const bIdx = order.indexOf(b.value);
      const aRank = aIdx === -1 ? Number.MAX_SAFE_INTEGER : aIdx;
      const bRank = bIdx === -1 ? Number.MAX_SAFE_INTEGER : bIdx;
      if (aRank !== bRank) return aRank - bRank;
      return a.label.localeCompare(b.label);
    });
  }, [availableCategories, currentCategories]);

  const tagGroupOptions = useMemo(() => {
    const availableSet = availableTags?.length
      ? new Set(availableTags.map((t) => t.value))
      : null;

    if (!availableSet) return TAG_GROUP_OPTIONS;

    const filtered = TAG_GROUP_OPTIONS
      .map((group) => ({
        group: group.group,
        options: group.options.filter(
          (opt) => availableSet.has(opt.value) || currentTags.includes(opt.value)
        ),
      }))
      .filter((group) => group.options.length > 0);

    return filtered.length > 0 ? filtered : TAG_GROUP_OPTIONS;
  }, [availableTags, currentTags]);

  // ─── URL update helper ─────────────────────────────────────────────────────
  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      // Build the new params from the current effective state (local override
      // or searchParams) so rapid toggling stays consistent.
      const params = new URLSearchParams(effectiveParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value) params.delete(key);
        else params.set(key, value);
      }
      params.set("view", "find");
      params.delete("page");
      const url = params.toString() ? `${pathname}?${params.toString()}` : pathname;

      // Write to history without triggering a Next.js navigation cycle.
      // This avoids re-entering Suspense boundaries on every filter toggle.
      window.history.replaceState(null, "", url);

      // Notify data-fetching hooks (useTimeline, useEventFilters) that the URL
      // changed so they re-read params and refetch. Without this, hooks using
      // useReplaceStateParams would never see the change.
      dispatchReplaceState();

      // Immediately update local state so the UI reflects the change without
      // waiting for useSearchParams to re-render (which it won't from replaceState).
      setLocalParams(params);
    },
    [pathname, effectiveParams]
  );

  // ─── Toggle helpers ────────────────────────────────────────────────────────
  const toggleCategory = useCallback(
    (category: string) => {
      const next = currentCategories.includes(category)
        ? currentCategories.filter((c) => c !== category)
        : [...currentCategories, category];
      updateParams({ categories: next.length > 0 ? next.join(",") : null });
    },
    [currentCategories, updateParams]
  );

  const toggleGenre = useCallback(
    (genre: string) => {
      const next = currentGenres.includes(genre)
        ? currentGenres.filter((g) => g !== genre)
        : [...currentGenres, genre];
      updateParams({ genres: next.length > 0 ? next.join(",") : null });
    },
    [currentGenres, updateParams]
  );

  const toggleTag = useCallback(
    (tag: string) => {
      const next = currentTags.includes(tag)
        ? currentTags.filter((v) => v !== tag)
        : [...currentTags, tag];
      updateParams({ tags: next.length > 0 ? next.join(",") : null });
    },
    [currentTags, updateParams]
  );

  const toggleVibe = useCallback(
    (vibe: string) => {
      const next = currentVibes.includes(vibe)
        ? currentVibes.filter((v) => v !== vibe)
        : [...currentVibes, vibe];
      updateParams({ vibes: next.length > 0 ? next.join(",") : null });
    },
    [currentVibes, updateParams]
  );

  const setMoodFilter = useCallback(
    (mood: string) => {
      updateParams({ mood: currentMood === mood ? null : mood });
    },
    [currentMood, updateParams]
  );

  const setDateFilter = useCallback(
    (date: string) => {
      // Empty string = "Upcoming" (clear date filter)
      updateParams({ date: !date || currentDateFilter === date ? null : date });
    },
    [currentDateFilter, updateParams]
  );

  const toggleFreeOnly = useCallback(() => {
    updateParams({
      free: currentFreeOnly ? null : "1",
      price: currentFreeOnly ? null : "free",
    });
  }, [currentFreeOnly, updateParams]);

  const clearAll = useCallback(() => {
    updateParams({
      categories: null,
      genres: null,
      date: null,
      free: null,
      price: null,
      tags: null,
      vibes: null,
      subcategories: null,
      mood: null,
    });
  }, [updateParams]);

  // ─── Fetch genre options when exactly one category is selected ─────────────
  useEffect(() => {
    const prev = prevCategoriesRef.current;
    prevCategoriesRef.current = currentCategories;

    if (currentCategories.length === 1) {
      const category = currentCategories[0];
      fetch(`/api/genres?category=${encodeURIComponent(category)}`)
        .then((res) => res.json())
        .then((data) => setGenreOptions(data.genres || []))
        .catch(() => setGenreOptions([]));
      return;
    }

    if (prev.length === 1 && currentGenres.length > 0) {
      updateParams({ genres: null });
    }
  }, [currentCategories]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Fetch availability-aware categories/tags ──────────────────────────────
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (portalId && portalId !== "default") params.set("portal_id", portalId);
    if (portalExclusive) params.set("portal_exclusive", "true");
    const query = params.toString();
    const endpoint = query ? `/api/filters?${query}` : "/api/filters";

    fetch(endpoint, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setAvailableCategories(Array.isArray(data.categories) ? data.categories : null);
        setAvailableTags(Array.isArray(data.tags) ? data.tags : null);
      })
      .catch(() => {
        setAvailableCategories(null);
        setAvailableTags(null);
      });

    return () => controller.abort();
  }, [portalExclusive, portalId]);

  // ─── Auto-track filter changes ─────────────────────────────────────────────
  useEffect(() => {
    if (!enableTracking || !portalSlug) return;

    const prev = prevSnapshotRef.current;
    prevSnapshotRef.current = snapshot;

    if (!prev) return;
    if (prev.signature === snapshot.signature) return;

    const changedKeys = diffFindFilterKeys(prev, snapshot);
    if (changedKeys.length === 0) return;

    trackFindFilterChange({
      portalSlug,
      findType,
      snapshot,
      changedKeys,
    });
  }, [snapshot, enableTracking, portalSlug, findType]);

  return {
    currentCategories,
    currentGenres,
    currentTags,
    currentVibes,
    currentMood,
    currentDateFilter,
    effectiveDateFilter,
    currentFreeOnly,
    hasFilters,
    filterCount,
    categoryOptions,
    tagGroupOptions,
    vibeGroupOptions: VIBE_GROUP_OPTIONS,
    moodOptions: [],
    genreOptions,
    updateParams,
    toggleCategory,
    toggleGenre,
    toggleTag,
    toggleVibe,
    setMoodFilter,
    setDateFilter,
    toggleFreeOnly,
    clearAll,
    isPending: false,
    snapshot,
  };
}
