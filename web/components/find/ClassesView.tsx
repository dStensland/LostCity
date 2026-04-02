"use client";

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useClassesData } from "@/lib/hooks/useClassesData";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ClassesViewProps {
  portalId: string;
  portalSlug: string;
}

// ---------------------------------------------------------------------------
// Lazy-loaded sub-views
// ---------------------------------------------------------------------------

function LoadingFallback() {
  return (
    <div className="px-4 py-8 space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-20 rounded-card bg-[var(--night)] border border-[var(--twilight)]/40 animate-pulse"
        />
      ))}
    </div>
  );
}

const ClassStudiosList = dynamic(
  () =>
    import("./classes/ClassStudiosList").then((m) => m.ClassStudiosList),
  { loading: () => <LoadingFallback /> },
);

const ClassStudioSchedule = dynamic(
  () =>
    import("./classes/ClassStudioSchedule").then((m) => m.ClassStudioSchedule),
  { loading: () => <LoadingFallback /> },
);

// ---------------------------------------------------------------------------
// ClassesView
// ---------------------------------------------------------------------------

export function ClassesView({ portalSlug }: ClassesViewProps) {
  const searchParams = useSearchParams();

  // Initialize state from URL on mount. useSearchParams does NOT re-render on
  // window.history.replaceState, so we drive all filter state through useState.
  const [category, setCategory] = useState(searchParams.get("category"));
  const [dateWindow, setDateWindow] = useState(searchParams.get("window"));
  const [skillLevel, setSkillLevel] = useState(searchParams.get("skill"));
  const [search, setSearch] = useState(searchParams.get("q"));
  const [studioSlug, setStudioSlug] = useState(searchParams.get("studio"));

  // Data hook — receives state values, not URL search params
  const { studios, schedule, studiosLoading, scheduleLoading, error } =
    useClassesData({
      portalSlug,
      category,
      dateWindow,
      skillLevel,
      search,
      studioSlug,
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
      const url = new URL(window.location.href);

      if ("category" in params) {
        if (params.category === null) url.searchParams.delete("category");
        else url.searchParams.set("category", params.category);
      }
      if ("window" in params || "dateWindow" in params) {
        const val = "window" in params ? params.window : params.dateWindow;
        if (val === null) url.searchParams.delete("window");
        else url.searchParams.set("window", val);
      }
      if ("skill" in params || "skillLevel" in params) {
        const val = "skill" in params ? params.skill : params.skillLevel;
        if (val === null) url.searchParams.delete("skill");
        else url.searchParams.set("skill", val);
      }
      if ("search" in params) {
        if (params.search === null) url.searchParams.delete("q");
        else url.searchParams.set("q", params.search);
      }
      if ("q" in params) {
        if (params.q === null) url.searchParams.delete("q");
        else url.searchParams.set("q", params.q);
      }
      if ("studio" in params) {
        if (params.studio === null) url.searchParams.delete("studio");
        else url.searchParams.set("studio", params.studio);
      }

      window.history.replaceState(window.history.state, "", url.toString());
    },
    [],
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
