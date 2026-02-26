"use client";

import React, { useState } from "react";
import VenueCard from "./VenueCard";
import { useVenueDiscovery } from "@/lib/hooks/useVenueDiscovery";
import VenueFilterBar from "@/components/find/VenueFilterBar";
import VenueListView, { type SortOption } from "@/components/find/VenueListView";
import { SPOTS_TABS, getTabChips, type SpotsTab } from "@/lib/spots-constants";

// ---------------------------------------------------------------------------
// Sub-Tab Bar
// ---------------------------------------------------------------------------

const TAB_ICONS: Record<string, React.ReactNode> = {
  "fork-knife": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v18M8 3v6a4 4 0 004 4M16 3v2a2 2 0 01-2 2h-1" />
    </svg>
  ),
  compass: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
    </svg>
  ),
  moon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  ),
};

function SpotsTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: SpotsTab;
  onTabChange: (tab: SpotsTab) => void;
}) {
  return (
    <div className="flex gap-0.5 mb-3 border-b border-[var(--twilight)]/50">
      {SPOTS_TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`relative flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 font-mono text-xs font-medium whitespace-nowrap transition-all active:scale-[0.98] ${
              isActive
                ? "text-[var(--cream)]"
                : "text-[var(--muted)] hover:text-[var(--soft)]"
            }`}
            aria-pressed={isActive}
          >
            <span className={isActive ? "text-[var(--coral)]" : ""}>{TAB_ICONS[tab.icon]}</span>
            <span>{tab.label}</span>
            {isActive && (
              <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-[var(--coral)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface Props {
  portalId: string;
  portalSlug: string;
  isExclusive?: boolean;
}

export default function PortalSpotsView({ portalId, portalSlug, isExclusive = false }: Props) {
  const {
    spots,
    filteredSpots,
    loading,
    fetchError,
    filters,
    setFilters,
    meta,
    retry,
    contextLabel,
    userLocation,
    setUserLocation,
    activeTab,
    setActiveTab,
  } = useVenueDiscovery({ portalId, portalSlug, isExclusive });

  const [sortByRaw, setSortBy] = useState<SortOption>("category");

  // Auto-promote to distance sort when location becomes available and user
  // hasn't explicitly chosen a sort yet. Derived inline to avoid
  // cascading renders from setState-in-effect.
  const sortBy: SortOption =
    userLocation && sortByRaw === "category" ? "distance" : sortByRaw;

  // Derive active chip label for empty state feedback
  const activeChipLabel = filters.occasion
    ? getTabChips(activeTab).find((c) => c.key === filters.occasion)?.label ?? null
    : null;

  return (
    <div className="py-3">
      <section className="mb-4 rounded-2xl border border-[var(--twilight)]/80 bg-[var(--void)]/70 backdrop-blur-md p-3 sm:p-4">
        <SpotsTabBar activeTab={activeTab} onTabChange={setActiveTab} />
        <VenueFilterBar
          filters={filters}
          setFilters={setFilters}
          openCount={meta.openCount}
          neighborhoods={meta.neighborhoods}
          portalSlug={portalSlug}
          portalId={portalId}
          contextLabel={contextLabel}
          userLocation={userLocation}
          onLocationChange={setUserLocation}
          activeTab={activeTab}
          filteredCount={filteredSpots.length}
        />
        <VenueListView
          spots={filteredSpots}
          sortBy={sortBy}
          setSortBy={setSortBy}
          portalSlug={portalSlug}
          loading={loading}
          fetchError={fetchError}
          onRetry={retry}
          filteredCount={filteredSpots.length}
          totalCount={spots.length}
          hasLocation={userLocation != null}
          userLocation={userLocation}
          activeTab={activeTab}
          activeChipLabel={activeChipLabel}
          renderCard={(spot) => (
            <VenueCard
              key={spot.id}
              venue={spot}
              portalSlug={portalSlug}
              variant="discovery"
              showDistance={userLocation ?? undefined}
            />
          )}
        />
      </section>
    </div>
  );
}
