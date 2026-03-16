"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BookOpen, ArrowRight, Mountains } from "@phosphor-icons/react";
import { QuestProgressCard } from "./QuestProgressCard";
import { SectionHeader } from "./SectionHeader";
import { useAdventureProgress } from "@/lib/hooks/useAdventureProgress";
import {
  YONDER_LAUNCH_DESTINATION_NODE_QUESTS,
} from "@/config/yonder-launch-destination-nodes";
import type { YonderDestinationIntelligence } from "@/config/yonder-destination-intelligence";
import { ADV, ADV_FONT } from "@/lib/adventure-tokens";
import SmartImage from "@/components/SmartImage";

// ---- Types ---------------------------------------------------------------

export interface OutThereLogProps {
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

type DestinationNodeCard = {
  id: string;
  title: string;
  destinationNodeType: string;
  launchPriority: number;
  summary: string;
  questIds: string[];
  spot: {
    id: number;
    slug: string;
    name: string;
    venueType: string | null;
    city: string | null;
    imageUrl: string | null;
  };
};

// ---- Empty state intro card ----------------------------------------------

function EmptyLogIntroCard({ portalSlug }: { portalSlug: string }) {
  return (
    <div
      className="p-6"
      style={{ border: `2px solid ${ADV.DARK}`, borderRadius: 0, backgroundColor: ADV.CARD }}
    >
      <p
        className="text-xs font-bold uppercase mb-2"
        style={{
          letterSpacing: "0.1em",
          color: ADV.TERRACOTTA,
        }}
      >
        Start Your Log
      </p>
      <p className="text-sm leading-relaxed mb-4" style={{ color: ADV.STONE }}>
        Visit destinations and mark them complete to track your progress. Each quest line unlocks as you explore.
      </p>
      <Link
        href={`/${portalSlug}?tab=explore`}
        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase hover:underline"
        style={{
          letterSpacing: "0.1em",
          color: ADV.TERRACOTTA,
        }}
      >
        Browse Destinations
        <ArrowRight size={12} weight="bold" />
      </Link>
    </div>
  );
}

// ---- Main component ------------------------------------------------------

export function OutThereLog({ portalSlug }: OutThereLogProps) {
  const { visitedSlugs, isVisited, getVisitedCount } = useAdventureProgress();

  const { data: destData } = useQuery<{ destinations: YonderDestinationCard[] }>({
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

  const { data: nodesData } = useQuery<{ destinationNodes: DestinationNodeCard[] }>({
    queryKey: ["adventure-destination-nodes", portalSlug],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(`/api/portals/${portalSlug}/yonder/destination-nodes`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Destination nodes fetch failed: ${res.status}`);
        return res.json();
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const destinations = useMemo(() => destData?.destinations ?? [], [destData?.destinations]);
  const nodes = useMemo(() => nodesData?.destinationNodes ?? [], [nodesData?.destinationNodes]);

  // Which destinations have been visited
  // isVisited already closes over visitedSlugs — no need to list it separately
  const visitedDestinations = useMemo(
    () => destinations.filter((d) => isVisited(d.slug)),
    [destinations, isVisited],
  );

  // Quest progress derived from nodes
  // getVisitedCount already closes over visitedSlugs — no need to list it separately
  const questProgress = useMemo(() => {
    return YONDER_LAUNCH_DESTINATION_NODE_QUESTS.map((quest) => {
      const questNodes = nodes.filter((n) => n.questIds.includes(quest.id));
      const slugs = questNodes.map((n) => n.spot.slug);
      const visited = getVisitedCount(slugs);
      return {
        quest,
        totalNodes: questNodes.length,
        visitedCount: visited,
      };
    }).filter((qp) => qp.totalNodes > 0);
  }, [nodes, getVisitedCount]);

  const totalVisited = visitedSlugs.length;

  const sectionHeader = <SectionHeader label="Out There Log" icon={BookOpen} />;

  return (
    <div className="px-4 pb-10 pt-4 sm:px-0 space-y-6">
      {sectionHeader}

      {/* Stats bar */}
      {totalVisited > 0 && (
        <div
          className="grid grid-cols-2"
          style={{ border: `2px solid ${ADV.DARK}`, borderRadius: 0 }}
        >
          {/* Col 1: dark bg */}
          <div
            className="flex flex-col items-center justify-center py-4"
            style={{ backgroundColor: ADV.DARK }}
          >
            <span
              className="font-bold leading-none"
              style={{ fontSize: "2rem", color: "#FFFFFF", fontFamily: ADV_FONT }}
            >
              {totalVisited}
            </span>
            <span
              className="text-xs font-bold uppercase mt-1"
              style={{ letterSpacing: "0.1em", color: `${ADV.CREAM}90` }}
            >
              Visited
            </span>
          </div>
          {/* Col 2: light bg */}
          <div
            className="flex flex-col items-center justify-center py-4"
            style={{ backgroundColor: ADV.CARD, borderLeft: `2px solid ${ADV.DARK}` }}
          >
            <span
              className="font-bold leading-none"
              style={{ fontSize: "2rem", color: ADV.DARK, fontFamily: ADV_FONT }}
            >
              {questProgress.filter(qp => qp.visitedCount > 0).length}
            </span>
            <span
              className="text-xs font-bold uppercase mt-1"
              style={{ letterSpacing: "0.1em", color: ADV.STONE }}
            >
              Quests
            </span>
          </div>
        </div>
      )}

      {/* Empty state intro card — only shown when nothing logged yet */}
      {totalVisited === 0 && <EmptyLogIntroCard portalSlug={portalSlug} />}

      {/* Quest progress bars — always shown when quest data is loaded */}
      {questProgress.length > 0 && (
        <div>
          <div
            className="py-2 mb-3 text-xs font-bold uppercase border-b"
            style={{
              letterSpacing: "0.12em",
              color: ADV.STONE,
              borderBottomColor: `${ADV.DARK}20`,
            }}
          >
            {totalVisited > 0 ? "Quest Progress" : "Available Quests"}
          </div>
          <div className="space-y-4">
            {questProgress.map(({ quest, totalNodes, visitedCount }) => (
              <QuestProgressCard
                key={quest.id}
                questId={quest.id}
                title={quest.title}
                subtitle={quest.subtitle}
                totalNodes={totalNodes}
                visitedCount={visitedCount}
                portalSlug={portalSlug}
              />
            ))}
          </div>
        </div>
      )}

      {/* Visited destinations list — only shown once user has been somewhere */}
      {visitedDestinations.length > 0 && (
        <div>
          <div
            className="py-2 mb-3 text-xs font-bold uppercase border-b"
            style={{
              letterSpacing: "0.12em",
              color: ADV.STONE,
              borderBottomColor: `${ADV.DARK}20`,
            }}
          >
            Places You&apos;ve Been
          </div>
          <div
            style={{
              border: `2px solid ${ADV.DARK}`,
              borderRadius: 0,
            }}
          >
            {visitedDestinations.map((destination, idx) => (
              <Link
                key={destination.slug}
                href={`/${portalSlug}/spots/${destination.slug}`}
                className="flex items-center gap-3 px-3 py-3 hover:bg-opacity-50 transition-colors"
                style={{
                  borderBottom: idx < visitedDestinations.length - 1 ? `1px solid ${ADV.DARK}20` : "none",
                  backgroundColor: ADV.CARD,
                }}
              >
                {/* Thumbnail */}
                <div
                  className="flex-shrink-0 overflow-hidden"
                  style={{ width: 56, height: 56, border: `1px solid ${ADV.DARK}20`, borderRadius: 0 }}
                >
                  {destination.imageUrl ? (
                    <SmartImage
                      src={destination.imageUrl}
                      alt={destination.name}
                      width={56}
                      height={56}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ backgroundColor: `${ADV.STONE}18` }}
                    >
                      <Mountains size={20} weight="regular" color={ADV.STONE} />
                    </div>
                  )}
                </div>
                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold leading-tight" style={{ fontSize: "0.9375rem", color: ADV.DARK }}>
                    {destination.name}
                  </p>
                  {destination.city && (
                    <p className="text-xs uppercase mt-0.5" style={{ letterSpacing: "0.08em", color: ADV.STONE }}>
                      {destination.city}{destination.state ? `, ${destination.state}` : ""}
                    </p>
                  )}
                </div>
                <ArrowRight size={14} weight="bold" color={ADV.STONE} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Cloud sync CTA */}
      <div
        className="p-4"
        style={{
          border: `2px solid ${ADV.DARK}`,
          borderRadius: 0,
          backgroundColor: `${ADV.DARK}04`,
        }}
      >
        <p
          className="text-xs font-bold uppercase mb-1"
          style={{
            letterSpacing: "0.1em",
            color: ADV.STONE,
          }}
        >
          Cloud Sync
        </p>
        <p className="text-sm" style={{ color: ADV.STONE }}>
          Your log is stored locally. Sign in to back it up and access it across devices.

        </p>
        <Link
          href="/auth/login"
          className="mt-3 inline-block text-xs font-bold uppercase hover:underline"
          style={{
            letterSpacing: "0.1em",
            color: ADV.TERRACOTTA,
          }}
        >
          Sign In →
        </Link>
      </div>
    </div>
  );
}
