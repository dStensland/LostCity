"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { ExploreHomeSection } from "./ExploreHomeSection";
import type { LaneSlug, ExploreHomeResponse } from "@/lib/types/explore-home";

// ---------------------------------------------------------------------------
// Lane order — fixed, never reorders between visits
// ---------------------------------------------------------------------------

const LANE_ORDER: LaneSlug[] = [
  "events",
  "shows",
  "regulars",
  "places",
  "classes",
  "calendar",
  "map",
];

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ExploreSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-card bg-[var(--night)] border border-[var(--twilight)]/40 p-4 sm:p-5 flex flex-col gap-3"
        >
          {/* Section header shimmer */}
          <div className="h-3 w-24 rounded bg-[var(--twilight)]" />

          {/* Two card placeholder rows */}
          {[0, 1].map((j) => (
            <div key={j} className="flex flex-col gap-1.5">
              <div className="aspect-[16/10] w-full rounded-lg bg-[var(--twilight)]" />
              <div className="h-2.5 w-3/4 rounded bg-[var(--twilight)]" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExploreHome
// ---------------------------------------------------------------------------

export interface ExploreHomeProps {
  portalSlug: string;
  data: ExploreHomeResponse | null;
  loading: boolean;
}

export function ExploreHome({ portalSlug, data, loading }: ExploreHomeProps) {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Submit search → events lane with query
  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`?view=find&lane=events&q=${encodeURIComponent(q)}`);
  }

  // Split lanes into two columns for desktop: even indices → col 1, odd → col 2
  const col1 = LANE_ORDER.filter((_, i) => i % 2 === 0);
  const col2 = LANE_ORDER.filter((_, i) => i % 2 !== 0);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-[1200px] mx-auto">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="mb-5 sm:mb-6">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] focus-within:border-[var(--coral)] transition-colors">
          <MagnifyingGlass
            size={16}
            weight="bold"
            className="shrink-0 text-[var(--muted)]"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search places, events, artists..."
            className="flex-1 bg-transparent text-[var(--cream)] placeholder:text-[var(--muted)] text-sm focus:outline-none"
            aria-label="Search"
          />
        </div>
      </form>

      {/* Loading skeleton */}
      {loading && <ExploreSkeleton />}

      {/* Error / empty state */}
      {!loading && !data && (
        <p className="text-sm text-[var(--muted)] text-center py-16">
          Could not load explore sections. Please try again.
        </p>
      )}

      {/* 2-col grid on desktop, single col on mobile */}
      {!loading && data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 lg:items-start">
          {/* Column 1 — even-indexed lanes */}
          <div className="flex flex-col gap-4 sm:gap-5">
            {col1.map((slug) => {
              const preview = data.lanes[slug];
              if (!preview) return null;
              return (
                <ExploreHomeSection
                  key={slug}
                  laneSlug={slug}
                  preview={preview}
                  portalSlug={portalSlug}
                />
              );
            })}
          </div>

          {/* Column 2 — odd-indexed lanes */}
          <div className="flex flex-col gap-4 sm:gap-5">
            {col2.map((slug) => {
              const preview = data.lanes[slug];
              if (!preview) return null;
              return (
                <ExploreHomeSection
                  key={slug}
                  laneSlug={slug}
                  preview={preview}
                  portalSlug={portalSlug}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
