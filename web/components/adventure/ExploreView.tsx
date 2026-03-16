"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mountains, Lightning, Compass } from "@phosphor-icons/react";
import { CommitmentFilter, type CommitmentTier } from "./CommitmentFilter";
import { DestinationCard } from "./DestinationCard";
import { FeaturedDestinationCard } from "./FeaturedDestinationCard";
import { QuestMiniCard } from "./QuestMiniCard";
import { ConditionsBanner } from "./ConditionsBanner";
import { SectionHeader } from "./SectionHeader";
import {
  AdventureEventCard,
  AdventureEventCardSkeleton,
} from "./AdventureEventCard";
import { useAdventureProgress } from "@/lib/hooks/useAdventureProgress";
import { useWeather } from "@/lib/hooks/useWeather";
import {
  YONDER_LAUNCH_DESTINATION_NODE_QUESTS,
} from "@/config/yonder-launch-destination-nodes";
import type { YonderDestinationIntelligence } from "@/config/yonder-destination-intelligence";
import { ADV } from "@/lib/adventure-tokens";

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
  const { isVisited, markVisited, visitedSlugs, getVisitedCount } = useAdventureProgress();
  const weather = useWeather();

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

  // Fetch destination nodes for quest mini-cards
  const { data: nodesData } = useQuery<{
    destinationNodes: {
      id: string;
      title: string;
      questIds: string[];
      spot: { slug: string };
    }[];
  }>({
    queryKey: ["adventure-destination-nodes", portalSlug],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(
          `/api/portals/${portalSlug}/yonder/destination-nodes`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`Destination nodes fetch failed: ${res.status}`);
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
  const nodes = useMemo(() => nodesData?.destinationNodes ?? [], [nodesData?.destinationNodes]);

  // Quest progress for mini-cards (only shown if user has visited at least 1 destination)
  const questProgress = useMemo(() => {
    return YONDER_LAUNCH_DESTINATION_NODE_QUESTS.map((quest) => {
      const questNodes = nodes.filter((n) => n.questIds.includes(quest.id));
      const slugs = questNodes.map((n) => n.spot.slug);
      const visited = getVisitedCount(slugs);
      return { quest, totalNodes: questNodes.length, visitedCount: visited };
    }).filter((qp) => qp.totalNodes > 0);
  }, [nodes, getVisitedCount]);

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
        <SectionHeader label="Destinations" icon={Mountains} />
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
        <SectionHeader label="Destinations" icon={Mountains} />
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

  const heroDestination = filtered[0] ?? null;
  const gridDestinations = filtered.length > 1 ? filtered.slice(1) : [];

  return (
    <div className="px-4 pb-10 pt-4 sm:px-0">
      {/* 1. Conditions Banner */}
      {!weather.loading && weather.condition && (
        <ConditionsBanner
          temp={weather.temp}
          condition={weather.condition}
          emoji={weather.emoji}
          windSpeed={weather.windSpeed}
          humidity={weather.humidity}
        />
      )}

      {/* 2. Your Quests — horizontal scroll, only if user has visited destinations */}
      {visitedSlugs.length > 0 && questProgress.length > 0 && (
        <div className="mb-8">
          <SectionHeader label="Your Quests" icon={Compass} />
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {questProgress.map(({ quest, totalNodes, visitedCount }) => (
              <QuestMiniCard
                key={quest.id}
                questId={quest.id}
                title={quest.title}
                visitedCount={visitedCount}
                totalNodes={totalNodes}
                portalSlug={portalSlug}
              />
            ))}
          </div>
        </div>
      )}

      {/* 3. Destinations section header */}
      <SectionHeader label="Destinations" icon={Mountains} />

      {/* 4. Commitment filter strip */}
      {availableTiers.length > 1 && (
        <div className="mb-5">
          <CommitmentFilter
            activeTier={activeTier}
            onTierChange={handleTierChange}
            availableTiers={availableTiers}
          />
        </div>
      )}

      {/* 5. Results count */}
      <p
        className="mb-4 text-xs font-bold uppercase"
        style={{
          letterSpacing: "0.1em",
          color: ADV.STONE,
        }}
      >
        {filtered.length} {activeTier ? TIER_LABEL_SUFFIX[activeTier] : "destinations"}
      </p>

      {/* 6. Featured destination hero card */}
      {heroDestination && (
        <div className="mb-4">
          <FeaturedDestinationCard
            name={heroDestination.name}
            slug={heroDestination.slug}
            imageUrl={heroDestination.imageUrl}
            commitmentTier={heroDestination.commitmentTier}
            summary={heroDestination.summary}
            portalSlug={portalSlug}
          />
        </div>
      )}

      {/* 7. Destination grid — remaining destinations */}
      {gridDestinations.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gridDestinations.map((destination) => (
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
      )}

      {/* 8. Upcoming Happenings events section */}
      {(eventsLoading || upcomingEvents.length > 0) && (
        <div className="mt-10">
          <SectionHeader label="Upcoming Happenings" icon={Lightning} />
          <p
            className="text-sm mb-4 -mt-2"
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
