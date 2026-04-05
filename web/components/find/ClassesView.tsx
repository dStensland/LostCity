"use client";

import { useState, useCallback } from "react";
import { useClassesData } from "@/lib/hooks/useClassesData";
import { useExploreUrlState } from "@/lib/explore-platform/url-state";
import { ClassStudiosList } from "./classes/ClassStudiosList";
import { ClassStudioSchedule } from "./classes/ClassStudioSchedule";
import type { ClassesLaneInitialData } from "@/lib/explore-platform/lane-data";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ClassesViewProps {
  portalId: string;
  portalSlug: string;
  initialData?: ClassesLaneInitialData | null;
}

export function ClassesView({ portalSlug, initialData = null }: ClassesViewProps) {
  const state = useExploreUrlState();

  // Initialize state from URL on mount. useSearchParams does NOT re-render on
  // window.history.replaceState, so we drive all filter state through useState.
  const [category, setCategory] = useState(state.params.get("category"));
  const [dateWindow, setDateWindow] = useState(state.params.get("window"));
  const [skillLevel, setSkillLevel] = useState(state.params.get("skill"));
  const [search, setSearch] = useState(state.params.get("q"));
  const [studioSlug, setStudioSlug] = useState(state.params.get("studio"));

  // Data hook — receives state values, not URL search params
  const { studios, schedule, studiosLoading, scheduleLoading, error } =
    useClassesData({
      portalSlug,
      category,
      dateWindow,
      skillLevel,
      search,
      studioSlug,
      initialPayload: initialData,
    });

  // Update one or more filter values and sync to URL without triggering navigation.
  //
  // Key mapping notes:
  //  - ClassStudiosList calls onFilterChange({ window: ... }) for date window
  //  - ClassStudioSchedule calls onFilterChange({ dateWindow: ... }) for date window
  //    Both map to the same dateWindow state and the "window" URL param.
  //  - ClassStudiosList calls onFilterChange({ search: ... })
  //    Maps to the "q" URL param.
  const updateFilters = useCallback(
    (params: Record<string, string | null>) => {
      // --- Update state ---
      if ("category" in params) setCategory(params.category ?? null);

      // Accept both "window" (from studios list) and "dateWindow" (from schedule)
      if ("window" in params) setDateWindow(params.window ?? null);
      if ("dateWindow" in params) setDateWindow(params.dateWindow ?? null);

      // Accept both "skill" (URL key) and "skillLevel" (component key)
      if ("skill" in params) setSkillLevel(params.skill ?? null);
      if ("skillLevel" in params) setSkillLevel(params.skillLevel ?? null);

      // "search" from components, "q" in the URL
      if ("search" in params) setSearch(params.search ?? null);
      if ("q" in params) setSearch(params.q ?? null);

      if ("studio" in params) setStudioSlug(params.studio ?? null);

      // --- Sync URL ---
      const nextParams: Record<string, string | null> = {};

      if ("category" in params) nextParams.category = params.category;
      if ("window" in params) nextParams.window = params.window;
      if ("dateWindow" in params) nextParams.window = params.dateWindow;
      if ("skill" in params) nextParams.skill = params.skill;
      if ("skillLevel" in params) nextParams.skill = params.skillLevel;
      if ("search" in params) nextParams.q = params.search;
      if ("q" in params) nextParams.q = params.q;
      if ("studio" in params) nextParams.studio = params.studio;

      state.setLaneParams(nextParams, "replace");
    },
    [state],
  );

  // Studio detail view
  if (studioSlug) {
    const studioMeta =
      studios?.studios.find((s) => s.slug === studioSlug) ?? null;
    return (
      <ClassStudioSchedule
        schedule={schedule?.classes ?? null}
        studioMeta={studioMeta}
        studioSlug={studioSlug}
        portalSlug={portalSlug}
        loading={scheduleLoading}
        error={error}
        dateWindow={dateWindow}
        skillLevel={skillLevel}
        onFilterChange={updateFilters}
      />
    );
  }

  // Studios list view
  return (
    <ClassStudiosList
      studios={studios}
      portalSlug={portalSlug}
      loading={studiosLoading}
      error={error}
      category={category}
      dateWindow={dateWindow}
      skillLevel={skillLevel}
      search={search}
      onFilterChange={updateFilters}
    />
  );
}
