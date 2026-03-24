"use client";

import { useState, useMemo } from "react";
import type { OpenCallWithOrg } from "@/lib/open-calls-utils";
import { OpenCallFilters } from "./OpenCallFilters";
import { OpenCallCard } from "./OpenCallCard";

interface OpenCallsBoardProps {
  initialCalls: OpenCallWithOrg[];
  portalSlug: string;
}

/**
 * Client component that owns filter state for the Open Calls Board.
 * Data is fetched server-side and passed in as initialCalls.
 * Filtering is done client-side for instant response (data set is small).
 * Uses window.history.replaceState to persist filter state in URL
 * without triggering a Next.js navigation cycle.
 */
export function OpenCallsBoard({ initialCalls }: OpenCallsBoardProps) {
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

  const filtered = useMemo(() => {
    return initialCalls.filter((call) => {
      if (activeType !== "all" && call.call_type !== activeType) return false;
      if (activeTier !== "all" && call.confidence_tier !== activeTier) return false;
      return true;
    });
  }, [initialCalls, activeType, activeTier]);

  return (
    <div className="space-y-6">
      <OpenCallFilters
        activeType={activeType}
        activeTier={activeTier}
        onTypeChange={handleTypeChange}
        onTierChange={handleTierChange}
      />

      {filtered.length === 0 ? (
        <EmptyState activeType={activeType} activeTier={activeTier} />
      ) : (
        <div className="divide-y divide-[var(--twilight)]">
          {filtered.map((call) => (
            <OpenCallCard key={call.id} call={call} />
          ))}
        </div>
      )}
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

function EmptyState({
  activeType,
  activeTier,
}: {
  activeType: string;
  activeTier: string;
}) {
  const isFiltered = activeType !== "all" || activeTier !== "all";

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
