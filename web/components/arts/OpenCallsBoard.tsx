"use client";

import { useState, useMemo } from "react";
import type { OpenCallWithOrg } from "@/lib/open-calls-utils";
import { OpenCallFilters } from "./OpenCallFilters";
import { OpenCallCard } from "./OpenCallCard";

interface OpenCallsBoardProps {
  localCalls: OpenCallWithOrg[];
  nationalCalls: OpenCallWithOrg[];
  portalSlug: string;
}

/**
 * Client component that owns filter state for the Open Calls Board.
 * Data is fetched server-side and passed in as two scoped lists.
 * Filtering is done client-side for instant response (data set is small).
 * Uses window.history.replaceState to persist filter state in URL
 * without triggering a Next.js navigation cycle.
 */
export function OpenCallsBoard({
  localCalls,
  nationalCalls,
}: OpenCallsBoardProps) {
  const [activeType, setActiveType] = useState("all");
  const [activeTier, setActiveTier] = useState("all");

  function handleTypeChange(value: string) {
    setActiveType(value);
    updateUrl({ type: value, tier: activeTier });
  }

  function handleTierChange(value: string) {
    setActiveTier(value);
    updateUrl({ type: activeType, tier: value });
  }

  const applyFilters = (calls: OpenCallWithOrg[]) =>
    calls.filter((call) => {
      if (activeType !== "all" && call.call_type !== activeType) return false;
      if (activeTier !== "all" && call.confidence_tier !== activeTier)
        return false;
      return true;
    });

  const filteredLocal = useMemo(
    () => applyFilters(localCalls),
    [localCalls, activeType, activeTier] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const filteredNational = useMemo(
    () => applyFilters(nationalCalls),
    [nationalCalls, activeType, activeTier] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const hasAny = filteredLocal.length > 0 || filteredNational.length > 0;
  const isFiltered = activeType !== "all" || activeTier !== "all";

  return (
    <div className="space-y-8">
      <OpenCallFilters
        activeType={activeType}
        activeTier={activeTier}
        onTypeChange={handleTypeChange}
        onTierChange={handleTierChange}
      />

      {!hasAny ? (
        <EmptyState isFiltered={isFiltered} />
      ) : (
        <>
          {/* Local & Regional Section */}
          {filteredLocal.length > 0 && (
            <section>
              <SectionHeader
                label="// local & regional"
                count={filteredLocal.length}
                description="Georgia-based organizations, residencies, and funding"
              />
              <div className="divide-y divide-[var(--twilight)]">
                {filteredLocal.map((call) => (
                  <OpenCallCard key={call.id} call={call} />
                ))}
              </div>
            </section>
          )}

          {/* National & International Section */}
          {filteredNational.length > 0 && (
            <section>
              <SectionHeader
                label="// national & international"
                count={filteredNational.length}
                description="Open to artists nationwide and beyond"
              />
              <div className="divide-y divide-[var(--twilight)]">
                {filteredNational.map((call) => (
                  <OpenCallCard key={call.id} call={call} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SectionHeader({
  label,
  count,
  description,
}: {
  label: string;
  count: number;
  description: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between mb-1">
        <h2 className="font-[family-name:var(--font-ibm-plex-mono)] text-xs font-bold text-[var(--action-primary)] uppercase tracking-[0.12em]">
          {label}
        </h2>
        <span className="font-[family-name:var(--font-ibm-plex-mono)] text-xs text-[var(--muted)]">
          {count}
        </span>
      </div>
      <p className="text-sm text-[var(--muted)] mb-3">{description}</p>
      <div className="border-t border-[var(--twilight)]" />
    </div>
  );
}

function updateUrl({
  type,
  tier,
}: {
  type: string;
  tier: string;
}) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (type === "all") {
    params.delete("type");
  } else {
    params.set("type", type);
  }
  if (tier === "all") {
    params.delete("tier");
  } else {
    params.set("tier", tier);
  }
  const query = params.toString();
  const newUrl = query
    ? `${window.location.pathname}?${query}`
    : window.location.pathname;
  window.history.replaceState(null, "", newUrl);
}

function EmptyState({ isFiltered }: { isFiltered: boolean }) {
  return (
    <div className="py-16 text-center border border-[var(--twilight)] bg-transparent">
      <p className="font-[family-name:var(--font-ibm-plex-mono)] text-sm text-[var(--muted)] mb-2">
        {isFiltered
          ? "// no calls match these filters"
          : "// no open calls right now"}
      </p>
      <p className="text-sm text-[var(--muted)]">
        {isFiltered
          ? "Try clearing a filter to see more results."
          : "Check back — we crawl new opportunities daily."}
      </p>
    </div>
  );
}
