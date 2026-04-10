"use client";

import { useState, useMemo, useEffect } from "react";
import type { ExhibitionWithVenue, ExhibitionType } from "@/lib/exhibitions-utils";
import { isCurrentlyShowing, isClosingSoon } from "@/lib/exhibitions-utils";
import { ExhibitionCard } from "./ExhibitionCard";

const SHOWING_OPTIONS = [
  { value: "current", label: "Currently Showing" },
  { value: "upcoming", label: "Opening Soon" },
  { value: "closing", label: "Closing Soon" },
] as const;

type ShowingFilter = (typeof SHOWING_OPTIONS)[number]["value"];

const TYPE_OPTIONS: { value: ExhibitionType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "solo", label: "Solo" },
  { value: "group", label: "Group" },
  { value: "installation", label: "Installation" },
  { value: "retrospective", label: "Retrospective" },
  { value: "popup", label: "Pop-Up" },
];

interface ExhibitionFeedProps {
  initialExhibitions: ExhibitionWithVenue[];
  portalSlug: string;
  totalFromApi: number;
}

/**
 * Client component that owns filter state for the Exhibition Feed.
 *
 * Data is fetched server-side (initial load) and passed in.
 * Filters for "closing soon" are applied client-side on the initial set.
 * Other filters (type) are also applied client-side.
 * "Opening soon" requires a separate API call (not in the current set).
 *
 * Uses window.history.replaceState for instant filter toggling
 * without triggering a full Next.js navigation cycle.
 */
export function ExhibitionFeed({
  initialExhibitions,
  portalSlug,
  totalFromApi,
}: ExhibitionFeedProps) {
  const [showingFilter, setShowingFilter] = useState<ShowingFilter>("current");
  const [typeFilter, setTypeFilter] = useState<ExhibitionType | "all">("all");
  const [visibleCount, setVisibleCount] = useState(12);
  const [upcomingExhibitions, setUpcomingExhibitions] = useState<ExhibitionWithVenue[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch "upcoming" exhibitions from the API when that tab is selected.
  // "current" and "closing" are both served from the initial server-fetched set:
  //   - current: filtered client-side by isCurrentlyShowing
  //   - closing: filtered client-side by isClosingSoon (subset of current)
  // "upcoming" has opening_date > today and is NOT in the initial current set.
  useEffect(() => {
    if (showingFilter !== "upcoming") return;

    let cancelled = false;
    const fetchUpcoming = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/exhibitions?portal=${encodeURIComponent(portalSlug)}&showing=upcoming&limit=100`
        );
        if (res.ok && !cancelled) {
          const data = await res.json();
          setUpcomingExhibitions(data.exhibitions ?? []);
        }
      } catch {
        // Silent fail — keep current data visible
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchUpcoming();
    return () => {
      cancelled = true;
    };
  }, [showingFilter, portalSlug]);

  function handleShowingChange(value: ShowingFilter) {
    setShowingFilter(value);
    setVisibleCount(12);
    updateUrl({ showing: value, type: typeFilter });
  }

  function handleTypeChange(value: ExhibitionType | "all") {
    setTypeFilter(value);
    setVisibleCount(12);
    updateUrl({ showing: showingFilter, type: value });
  }

  // Choose the source dataset based on the active showing filter.
  // "upcoming" uses the API-fetched set; others use the initial server-rendered set.
  const sourceData = showingFilter === "upcoming" ? (upcomingExhibitions ?? []) : initialExhibitions;

  const filtered = useMemo(() => {
    return sourceData.filter((ex) => {
      // Showing filter (client-side subset filtering for current and closing)
      if (showingFilter === "current" && !isCurrentlyShowing(ex)) return false;
      if (showingFilter === "closing" && !isClosingSoon(ex, 14)) return false;
      // "upcoming" is already server-filtered — no additional showing filter needed

      // Type filter
      if (typeFilter !== "all" && ex.exhibition_type !== typeFilter) return false;

      return true;
    });
  }, [sourceData, showingFilter, typeFilter]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  const isEmpty = filtered.length === 0;

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="space-y-3">
        {/* Showing filter */}
        <div className="flex gap-0 border border-[var(--twilight)] w-fit">
          {SHOWING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleShowingChange(opt.value)}
              className={`font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-[0.12em] px-4 py-2 transition-colors duration-100 border-r border-[var(--twilight)] last:border-r-0 ${
                showingFilter === opt.value
                  ? "bg-[var(--action-primary)] text-[var(--void)]"
                  : "bg-transparent text-[var(--muted)] hover:text-[var(--soft)] hover:bg-[var(--night)]/50"
              }`}
              aria-pressed={showingFilter === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Type filter chips */}
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleTypeChange(opt.value as ExhibitionType | "all")}
              className={`font-[family-name:var(--font-ibm-plex-mono)] text-2xs uppercase tracking-[0.12em] px-3 py-1.5 border transition-colors duration-100 ${
                typeFilter === opt.value
                  ? "border-[var(--action-primary)] text-[var(--action-primary)] bg-transparent"
                  : "border-[var(--twilight)] text-[var(--muted)] bg-transparent hover:border-[var(--soft)] hover:text-[var(--soft)]"
              }`}
              aria-pressed={typeFilter === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      <p className="font-[family-name:var(--font-ibm-plex-mono)] text-xs text-[var(--muted)] tracking-wider">
        {loading
          ? "// loading..."
          : isEmpty
          ? "// no exhibitions match"
          : `// ${filtered.length} exhibition${filtered.length !== 1 ? "s" : ""}`}
      </p>

      {/* Exhibition list */}
      {loading ? null : isEmpty ? (
        <EmptyState showingFilter={showingFilter} typeFilter={typeFilter} />
      ) : (
        <>
          <div className="divide-y divide-[var(--twilight)]">
            {visible.map((exhibition) => (
              <ExhibitionCard
                key={exhibition.id}
                exhibition={exhibition}
                portalSlug={portalSlug}
              />
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <button
              onClick={() => setVisibleCount((n) => n + 12)}
              className="w-full font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-[0.14em] text-[var(--muted)] hover:text-[var(--soft)] py-4 border border-[var(--twilight)] transition-colors"
            >
              {"// load more"} ({filtered.length - visibleCount} remaining)
            </button>
          )}
        </>
      )}

      {/* Total context when all loaded */}
      {!hasMore && totalFromApi > filtered.length && (
        <p className="font-[family-name:var(--font-ibm-plex-mono)] text-2xs text-[var(--muted)] tracking-wider text-center">
          Showing {filtered.length} of {totalFromApi} total — adjust filters to see more
        </p>
      )}
    </div>
  );
}

function updateUrl({
  showing,
  type,
}: {
  showing: string;
  type: string;
}) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);

  if (showing === "current") {
    params.delete("showing");
  } else {
    params.set("showing", showing);
  }

  if (type === "all") {
    params.delete("type");
  } else {
    params.set("type", type);
  }

  const query = params.toString();
  const newUrl = query
    ? `${window.location.pathname}?${query}`
    : window.location.pathname;
  window.history.replaceState(window.history.state, "", newUrl);
}

function EmptyState({
  showingFilter,
  typeFilter,
}: {
  showingFilter: ShowingFilter;
  typeFilter: ExhibitionType | "all";
}) {
  const isFiltered = showingFilter !== "current" || typeFilter !== "all";

  return (
    <div className="py-16 text-center border border-[var(--twilight)] bg-transparent">
      <p className="font-[family-name:var(--font-ibm-plex-mono)] text-sm text-[var(--muted)] mb-2">
        {showingFilter === "closing"
          ? "// nothing closing soon"
          : showingFilter === "upcoming"
          ? "// no upcoming exhibitions"
          : "// no exhibitions right now"}
      </p>
      <p className="text-sm text-[var(--muted)]">
        {isFiltered
          ? "Try adjusting your filters."
          : "Check back — we add new exhibitions as galleries update."}
      </p>
    </div>
  );
}
