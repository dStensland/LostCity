"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mountains, Lightning } from "@phosphor-icons/react";
import { CommitmentFilter, type CommitmentTier } from "./CommitmentFilter";
import { DestinationCard } from "./DestinationCard";
import {
  AdventureEventCard,
  AdventureEventCardSkeleton,
} from "./AdventureEventCard";
import { useAdventureProgress } from "@/lib/hooks/useAdventureProgress";
import type { YonderDestinationIntelligence } from "@/config/yonder-destination-intelligence";
import { ADV, ADV_FONT } from "@/lib/adventure-tokens";

// ---- Types ---------------------------------------------------------------

export interface ExploreViewProps {
  portalSlug: string;
}

type YonderDestinationCard = YonderDestinationIntelligence & {
  id: number;
  city: string | null;
  state: string | null;
  imageUrl: string | null;
  shortDescription: string | null;
  venueType: string | null;
};

// ---- Skeleton card -------------------------------------------------------

function SkeletonCard() {
  return (
    <div
      className="overflow-hidden"
      style={{ border: `2px solid ${ADV.DARK}`, borderRadius: 0, backgroundColor: "#FFFFFF" }}
    >
      <div
        className="h-40"
        style={{ backgroundColor: `${ADV.STONE}20` }}
      />
      <div className="p-4 space-y-2">
        <div className="h-3 w-24" style={{ backgroundColor: `${ADV.STONE}20`, borderRadius: 0 }} />
        <div className="h-5 w-40" style={{ backgroundColor: `${ADV.STONE}20`, borderRadius: 0 }} />
        <div className="h-3 w-full" style={{ backgroundColor: `${ADV.STONE}20`, borderRadius: 0 }} />
        <div className="h-3 w-3/4" style={{ backgroundColor: `${ADV.STONE}20`, borderRadius: 0 }} />
      </div>
    </div>
  );
}

// ---- Section header ------------------------------------------------------

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Mountains size={14} weight="bold" color={ADV.TERRACOTTA} />
      <span
        className="text-xs font-bold uppercase"
        style={{
          letterSpacing: "0.12em",
          color: ADV.TERRACOTTA,
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ---- Event type (matches API response) -----------------------------------

type AdventureEventData = {
  id: number;
  title: string;
  startDate: string;
  startTime: string | null;
  endTime: string | null;
  isAllDay: boolean;
  imageUrl: string | null;
  description: string | null;
  sourceUrl: string | null;
  ticketUrl: string | null;
  venueName: string | null;
  venueSlug: string | null;
  venueImageUrl: string | null;
  neighborhood: string | null;
  sourceName: string | null;
  tags: string[] | null;
};

// ---- Main component ------------------------------------------------------

const VALID_TIERS = new Set<CommitmentTier>(["hour", "halfday", "fullday", "weekend"]);

export function ExploreView({ portalSlug }: ExploreViewProps) {
  const [activeTier, setActiveTier] = useState<CommitmentTier | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const tier = params.get("tier");
    return tier && VALID_TIERS.has(tier as CommitmentTier) ? (tier as CommitmentTier) : null;
  });
  const { isVisited, markVisited } = useAdventureProgress();

  const handleTierChange = (tier: CommitmentTier | null) => {
    setActiveTier(tier);
    const url = new URL(window.location.href);
    if (tier) {
      url.searchParams.set("tier", tier);
    } else {
      url.searchParams.delete("tier");
    }
    window.history.replaceState({}, "", url.toString());
  };

  const { data, isLoading } = useQuery<{ destinations: YonderDestinationCard[] }>({
    queryKey: ["adventure-destinations", portalSlug],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(`/api/portals/${portalSlug}/yonder/destinations`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Destinations fetch failed: ${res.status}`);
        return res.json();
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Fetch upcoming events (next 30 days)
  const { data: eventsData, isLoading: eventsLoading } = useQuery<{
    events: AdventureEventData[];
  }>({
    queryKey: ["adventure-events", portalSlug, "month"],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(
          `/api/portals/${portalSlug}/yonder/events?window=month`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`Events fetch failed: ${res.status}`);
        return res.json();
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const upcomingEvents = eventsData?.events ?? [];
  const destinations = useMemo(() => data?.destinations ?? [], [data?.destinations]);

  // Derive available tiers in display order
  const availableTiers = useMemo((): CommitmentTier[] => {
    const tierOrder: CommitmentTier[] = ["hour", "halfday", "fullday", "weekend"];
    const present = new Set(destinations.map((d) => d.commitmentTier as CommitmentTier));
    return tierOrder.filter((t) => present.has(t));
  }, [destinations]);

  // Filter destinations by active tier (show all if no tier selected)
  const filtered = useMemo(() => {
    if (!activeTier) return destinations;
    return destinations.filter((d) => d.commitmentTier === activeTier);
  }, [destinations, activeTier]);

  if (isLoading) {
    return (
      <div className="px-4 pb-10 pt-4 sm:px-0">
        <SectionHeader label="Destinations" />
        <div className="mb-5">
          <div
            className="h-10 w-72"
            style={{ border: `2px solid ${ADV.DARK}`, borderRadius: 0, backgroundColor: `${ADV.STONE}12` }}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <SkeletonCard key={idx} />
          ))}
        </div>
      </div>
    );
  }

  if (destinations.length === 0) {
    return (
      <div className="px-4 pb-10 pt-4 sm:px-0">
        <SectionHeader label="Destinations" />
        <div
          className="p-8 text-center"
          style={{ border: `2px solid ${ADV.DARK}`, borderRadius: 0, backgroundColor: "#FFFFFF" }}
        >
          <p
            className="text-sm font-bold uppercase"
            style={{
              letterSpacing: "0.1em",
              color: ADV.STONE,
            }}
          >
            No destinations loaded
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-10 pt-4 sm:px-0">
      <SectionHeader label="Destinations" />

      {/* Commitment filter strip */}
      {availableTiers.length > 1 && (
        <div className="mb-5">
          <CommitmentFilter
            activeTier={activeTier}
            onTierChange={handleTierChange}
            availableTiers={availableTiers}
          />
        </div>
      )}

      {/* Results count */}
      <p
        className="mb-4 text-xs font-bold uppercase"
        style={{
          letterSpacing: "0.1em",
          color: ADV.STONE,
        }}
      >
        {filtered.length} {activeTier ? TIER_LABEL_SUFFIX[activeTier] : "destinations"}
      </p>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((destination) => (
          <DestinationCard
            key={destination.slug}
            name={destination.name}
            slug={destination.slug}
            imageUrl={destination.imageUrl}
            commitmentTier={destination.commitmentTier}
            difficultyLevel={destination.difficultyLevel}
            driveTimeMinutes={destination.driveTimeMinutes}
            summary={destination.summary}
            weatherFitTags={destination.weatherFitTags}
            portalSlug={portalSlug}
            visited={isVisited(destination.slug)}
            onMarkVisited={markVisited}
          />
        ))}
      </div>

      {/* ---- Upcoming events section ------------------------------------- */}
      {(eventsLoading || upcomingEvents.length > 0) && (
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-1">
            <Lightning size={14} weight="bold" color={ADV.TERRACOTTA} />
            <span
              className="text-xs font-bold uppercase"
              style={{
                fontFamily: ADV_FONT,
                letterSpacing: "0.12em",
                color: ADV.TERRACOTTA,
              }}
            >
              Upcoming Happenings
            </span>
          </div>
          <p
            className="text-sm mb-4"
            style={{ color: ADV.STONE }}
          >
            Group hikes, nature programs, and outdoor events
          </p>

          {eventsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <AdventureEventCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.slice(0, 6).map((event) => (
                <AdventureEventCard
                  key={event.id}
                  id={event.id}
                  title={event.title}
                  startDate={event.startDate}
                  startTime={event.startTime}
                  isAllDay={event.isAllDay}
                  venueName={event.venueName}
                  venueSlug={event.venueSlug}
                  neighborhood={event.neighborhood}
                  sourceName={event.sourceName}
                  imageUrl={event.imageUrl}
                  venueImageUrl={event.venueImageUrl}
                  tags={event.tags}
                  sourceUrl={event.sourceUrl}
                  ticketUrl={event.ticketUrl}
                  portalSlug={portalSlug}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const TIER_LABEL_SUFFIX: Record<CommitmentTier, string> = {
  hour: "quick trips",
  halfday: "half-day outings",
  fullday: "full-day destinations",
  weekend: "weekend escapes",
};
